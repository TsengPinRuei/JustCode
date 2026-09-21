/**
 * Java Executor：在隔離的暫存 workspace 中編譯並執行 Java 程式碼。
 * 產生 Runner.java harness，針對支援的題目 metadata 型別處理 JSON I/O、
 * 測試案例解析與結果序列化。
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { Testcase, CompilationError, ProblemMetadata } from '../types';
import { RESULT_SEPARATOR, EXECUTION_TIMEOUT_MS, COMPILE_TIMEOUT_MS, JAVA_SANDBOX_IMAGE } from '../constants';
import { SandboxRunner } from './sandboxRunner';
import { cleanupWorkspace, createWorkspace, executeTestcases, ExecutionSummary, parseTestcaseOutput, TestcaseExecution } from './executionUtils';
import { JAVA_JSON_SUPPORT } from './javaJsonSupport';

// 產生的 Runner.java parser/serializer 程式碼使用的 internal-to-Java 型別映射。
const JAVA_TYPE_MAP: Record<string, string> = {
    integer: 'int',
    int: 'int',
    'integer[]': 'int[]',
    'int[]': 'int[]',
    'integer[][]': 'int[][]',
    'int[][]': 'int[][]',
    string: 'String',
    'string[]': 'String[]',
    'string[][]': 'String[][]',
    boolean: 'boolean',
    bool: 'boolean',
    'boolean[]': 'boolean[]',
    'bool[]': 'boolean[]',
    double: 'double',
    float: 'double',
    'double[]': 'double[]',
    'float[]': 'double[]',
    long: 'long',
    'long[]': 'long[]',
    char: 'char',
    'char[]': 'char[]',
    'char[][]': 'char[][]',
    'list<integer>': 'List<Integer>',
    'list<int>': 'List<Integer>',
    'list<string>': 'List<String>',
    'list<list<integer>>': 'List<List<Integer>>',
    'list<list<int>>': 'List<List<Integer>>',
    'list<list<string>>': 'List<List<String>>',
    'list<boolean>': 'List<Boolean>',
    'list<bool>': 'List<Boolean>',
};

export class JavaExecutor {
    private readonly sandboxRunner = new SandboxRunner();

    /** 編譯 Solution.java 與 Runner.java；若有錯誤則回傳 compilation errors。 */
    private async compile(workspaceDir: string, timeoutMs: number): Promise<{ success: boolean; status?: 'CE' | 'RE' | 'TLE'; error?: string; compilationErrors?: CompilationError[] }> {
        // 編譯需要可寫 workspace，讓 javac 可在 source 旁輸出 .class 檔案。
        const result = await this.sandboxRunner.execute({
            command: 'javac',
            args: ['-encoding', 'UTF-8', 'Solution.java', 'Runner.java'],
            cwd: workspaceDir,
            timeoutMs,
            image: JAVA_SANDBOX_IMAGE,
            writableWorkspace: true,
        });

        if (result.exitCode !== 0) {
            const compilationErrors = this.parseJavaCompilationErrors(result.stderr);
            return {
                success: false,
                status: result.timedOut ? 'TLE' : compilationErrors.length ? 'CE' : 'RE',
                error: result.timedOut ? 'Compilation time limit exceeded' : result.stderr.slice(0, 4096) || 'Compilation failed',
                compilationErrors,
            };
        }

        return { success: true };
    }

    private async runTestcase(workspaceDir: string, testcase: Testcase, timeoutMs: number): Promise<TestcaseExecution> {
        const startTime = performance.now();
        const result = await this.sandboxRunner.execute({
            command: 'java',
            args: ['-Dfile.encoding=UTF-8', 'Runner'],
            cwd: workspaceDir,
            timeoutMs,
            stdin: JSON.stringify(testcase.input),
            image: JAVA_SANDBOX_IMAGE,
        });
        return parseTestcaseOutput(result, testcase, Math.round(performance.now() - startTime));
    }

    /** 將 javac 錯誤輸出解析成結構化 CompilationError objects。 */
    private parseJavaCompilationErrors(stderr: string): CompilationError[] {
        const errors: CompilationError[] = [];
        // Java 錯誤格式："Solution.java:3: error: cannot find symbol"。
        const errorRegex = /^(.+?\.java):(\d+):\s*(error|warning):\s*(.+)$/gm;
        let match;

        while ((match = errorRegex.exec(stderr)) !== null) {
            const [, file, lineStr, severity, message] = match;
            const line = parseInt(lineStr, 10);

            errors.push({
                file: path.basename(file),  // Monaco 只需要顯示用檔名。
                line,
                column: 1,  // javac 不一定為每個診斷提供穩定欄位。
                message: message.trim(),
                severity: severity as 'error' | 'warning',
            });
        }

        return errors;
    }

    async executeCode(
        userCode: string,
        testcases: Testcase[],
        showHiddenInputs = true,
        metadata?: ProblemMetadata,
        visibleTestcaseCount = testcases.length
    ): Promise<ExecutionSummary> {
        const deadline = performance.now() + EXECUTION_TIMEOUT_MS;
        const workspaceDir = await createWorkspace();
        try {
            let runnerCode: string;
            try {
                runnerCode = this.getRunnerTemplate(metadata);
            } catch (error) {
                return {
                    status: 'CE', message: error instanceof Error ? error.message : 'Unsupported problem metadata',
                    testcaseResults: [], totalTestcases: testcases.length, passedTestcases: 0,
                };
            }
            await fs.writeFile(path.join(workspaceDir, 'Solution.java'), userCode);
            await fs.writeFile(path.join(workspaceDir, 'Runner.java'), runnerCode);
            const compiled = await this.compile(workspaceDir, Math.min(COMPILE_TIMEOUT_MS, Math.max(1, deadline - performance.now())));
            if (!compiled.success) {
                return {
                    status: compiled.status || 'CE', message: compiled.error,
                    testcaseResults: [], totalTestcases: testcases.length, passedTestcases: 0,
                    compilationErrors: compiled.compilationErrors || [],
                };
            }
            return await executeTestcases(testcases, showHiddenInputs, visibleTestcaseCount, deadline,
                (testcase, timeoutMs) => this.runTestcase(workspaceDir, testcase, timeoutMs));
        } finally {
            await cleanupWorkspace(workspaceDir);
        }
    }

    // 將 internal/LeetCode type string 映射到 getParseCode() 可理解的 Java 宣告。
    private mapTypeToJava(typeStr: string): string {
        const t = typeStr.toLowerCase().trim();
        const mapped = Object.prototype.hasOwnProperty.call(JAVA_TYPE_MAP, t) ? JAVA_TYPE_MAP[t] : undefined;
        if (!mapped) throw new Error(`Unsupported Java judge type: ${typeStr}`);
        return mapped;
    }

    // 產生 Java statement，將已解析 JSON 轉成目標 method parameter type。
    private getParseCode(paramName: string, javaType: string, inputKey: string): string {
        switch (javaType) {
            case 'int':
                return `        int ${paramName} = ((Number) data.get(${JSON.stringify(inputKey)})).intValue();`;
            case 'long':
                return `        long ${paramName} = ((Number) data.get(${JSON.stringify(inputKey)})).longValue();`;
            case 'double':
                return `        double ${paramName} = ((Number) data.get(${JSON.stringify(inputKey)})).doubleValue();`;
            case 'boolean':
                return `        boolean ${paramName} = (Boolean) data.get(${JSON.stringify(inputKey)});`;
            case 'String':
                return `        String ${paramName} = (String) data.get(${JSON.stringify(inputKey)});`;
            case 'char':
                return `        char ${paramName} = ((String) data.get(${JSON.stringify(inputKey)})).charAt(0);`;
            case 'int[]':
                return `        int[] ${paramName} = toIntArray((java.util.List<?>) data.get(${JSON.stringify(inputKey)}));`;
            case 'long[]':
                return `        long[] ${paramName} = toLongArray((java.util.List<?>) data.get(${JSON.stringify(inputKey)}));`;
            case 'double[]':
                return `        double[] ${paramName} = toDoubleArray((java.util.List<?>) data.get(${JSON.stringify(inputKey)}));`;
            case 'boolean[]':
                return `        boolean[] ${paramName} = toBooleanArray((java.util.List<?>) data.get(${JSON.stringify(inputKey)}));`;
            case 'String[]':
                return `        String[] ${paramName} = toStringArray((java.util.List<?>) data.get(${JSON.stringify(inputKey)}));`;
            case 'char[]':
                return `        char[] ${paramName} = toCharArray((java.util.List<?>) data.get(${JSON.stringify(inputKey)}));`;
            case 'int[][]':
                return `        int[][] ${paramName} = toInt2DArray((java.util.List<?>) data.get(${JSON.stringify(inputKey)}));`;
            case 'char[][]':
                return `        char[][] ${paramName} = toChar2DArray((java.util.List<?>) data.get(${JSON.stringify(inputKey)}));`;
            case 'String[][]':
                return `        String[][] ${paramName} = toString2DArray((java.util.List<?>) data.get(${JSON.stringify(inputKey)}));`;
            case 'List<Integer>':
                return `        List<Integer> ${paramName} = toIntegerList((java.util.List<?>) data.get(${JSON.stringify(inputKey)}));`;
            case 'List<String>':
                return `        List<String> ${paramName} = toStringList((java.util.List<?>) data.get(${JSON.stringify(inputKey)}));`;
            case 'List<List<Integer>>':
                return `        List<List<Integer>> ${paramName} = toIntegerListList((java.util.List<?>) data.get(${JSON.stringify(inputKey)}));`;
            case 'List<List<String>>':
                return `        List<List<String>> ${paramName} = toStringListList((java.util.List<?>) data.get(${JSON.stringify(inputKey)}));`;
            case 'List<Boolean>':
                return `        List<Boolean> ${paramName} = toBooleanList((java.util.List<?>) data.get(${JSON.stringify(inputKey)}));`;
            default:
                throw new Error(`Unsupported Java parameter type: ${javaType}`);
        }
    }

    /** 依題目 metadata（params、return type）產生 Runner.java 執行包裝。 */
    private getRunnerTemplate(metadata?: ProblemMetadata): string {
        // 即使舊版內建題目缺少匯入 metadata 欄位，備援值仍可讓它們執行。
        if (!metadata?.functionName || !metadata?.params || !metadata?.returnType) {
            console.warn('Missing problem metadata (functionName/params/returnType); using hardcoded defaults');
        }
        const functionName = metadata?.functionName || 'sortArray';
        const params = metadata?.params || [{ name: 'nums', type: 'int[]' }];
        const returnType = this.mapTypeToJava(metadata?.returnType || 'int[]');

        const parseLines = params.map((param, index) =>
            this.getParseCode(`arg${index}`, this.mapTypeToJava(param.type), param.name)).join('\n');
        const argsList = params.map((_, index) => `arg${index}`).join(', ');

        return String.raw`import java.util.*;
import java.nio.charset.StandardCharsets;

public class Runner {
    public static void main(String[] args) {
        try {
            String inputJson = new String(System.in.readAllBytes(), StandardCharsets.UTF_8);
            Map<String, Object> data = parseJson(inputJson);
${parseLines}
            Solution solution = new Solution();
            ${returnType} result = solution.${functionName}(${argsList});
            String output = toJson(result);
            System.out.print("${RESULT_SEPARATOR}\n");
            System.out.println("{\"result\":" + output + "}");
        } catch (Exception error) {
            error.printStackTrace();
            System.exit(1);
        }
    }

${JAVA_JSON_SUPPORT}

    // ======================== 型別轉換器 ========================
    
    static int[] toIntArray(java.util.List<?> list) {
        if (list == null) return null;
        int[] arr = new int[list.size()];
        for (int i = 0; i < list.size(); i++) arr[i] = ((Number) list.get(i)).intValue();
        return arr;
    }
    
    static long[] toLongArray(java.util.List<?> list) {
        if (list == null) return null;
        long[] arr = new long[list.size()];
        for (int i = 0; i < list.size(); i++) arr[i] = ((Number) list.get(i)).longValue();
        return arr;
    }
    
    static double[] toDoubleArray(java.util.List<?> list) {
        if (list == null) return null;
        double[] arr = new double[list.size()];
        for (int i = 0; i < list.size(); i++) arr[i] = ((Number) list.get(i)).doubleValue();
        return arr;
    }
    
    static boolean[] toBooleanArray(java.util.List<?> list) {
        if (list == null) return null;
        boolean[] arr = new boolean[list.size()];
        for (int i = 0; i < list.size(); i++) arr[i] = (Boolean) list.get(i);
        return arr;
    }
    
    static String[] toStringArray(java.util.List<?> list) {
        if (list == null) return null;
        String[] arr = new String[list.size()];
        for (int i = 0; i < list.size(); i++) arr[i] = (String) list.get(i);
        return arr;
    }
    
    static char[] toCharArray(java.util.List<?> list) {
        if (list == null) return null;
        char[] arr = new char[list.size()];
        for (int i = 0; i < list.size(); i++) arr[i] = ((String) list.get(i)).charAt(0);
        return arr;
    }
    
    static int[][] toInt2DArray(java.util.List<?> list) {
        if (list == null) return null;
        int[][] arr = new int[list.size()][];
        for (int i = 0; i < list.size(); i++) {
            arr[i] = toIntArray((java.util.List<?>) list.get(i));
        }
        return arr;
    }
    
    static char[][] toChar2DArray(java.util.List<?> list) {
        if (list == null) return null;
        char[][] arr = new char[list.size()][];
        for (int i = 0; i < list.size(); i++) {
            arr[i] = toCharArray((java.util.List<?>) list.get(i));
        }
        return arr;
    }
    
    static String[][] toString2DArray(java.util.List<?> list) {
        if (list == null) return null;
        String[][] arr = new String[list.size()][];
        for (int i = 0; i < list.size(); i++) {
            arr[i] = toStringArray((java.util.List<?>) list.get(i));
        }
        return arr;
    }
    
    static List<Integer> toIntegerList(java.util.List<?> list) {
        if (list == null) return null;
        List<Integer> result = new ArrayList<>(list.size());
        for (Object o : list) result.add(((Number) o).intValue());
        return result;
    }
    
    static List<String> toStringList(java.util.List<?> list) {
        if (list == null) return null;
        List<String> result = new ArrayList<>(list.size());
        for (Object o : list) result.add((String) o);
        return result;
    }
    
    static List<Boolean> toBooleanList(java.util.List<?> list) {
        if (list == null) return null;
        List<Boolean> result = new ArrayList<>(list.size());
        for (Object o : list) result.add((Boolean) o);
        return result;
    }
    
    static List<List<Integer>> toIntegerListList(java.util.List<?> list) {
        if (list == null) return null;
        List<List<Integer>> result = new ArrayList<>(list.size());
        for (Object o : list) result.add(toIntegerList((java.util.List<?>) o));
        return result;
    }
    
    static List<List<String>> toStringListList(java.util.List<?> list) {
        if (list == null) return null;
        List<List<String>> result = new ArrayList<>(list.size());
        for (Object o : list) result.add(toStringList((java.util.List<?>) o));
        return result;
    }
    
}`;
    }
}
