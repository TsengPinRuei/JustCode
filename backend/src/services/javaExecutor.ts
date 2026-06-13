/**
 * Java Executor — Compiles and runs Java code in an isolated temp workspace.
 * Generates a Runner.java harness that handles JSON I/O, testcase parsing,
 * and result serialization for supported problem metadata types.
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Testcase, TestcaseResult, CompilationError, ProblemMetadata } from '../types';
import { RESULT_SEPARATOR, TESTCASE_TIMEOUT_MS, COMPILE_TIMEOUT_MS, JAVA_SANDBOX_IMAGE } from '../constants';
import { SandboxRunner } from './sandboxRunner';

// Internal-to-Java type mapping used by generated Runner.java parser/serializer code.
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

    /** Create a per-run workspace so user files/classes never collide across executions. */
    private async createTempWorkspace(): Promise<string> {
        const tmpDir = path.join(process.cwd(), 'temp', uuidv4());
        await fs.mkdir(tmpDir, { recursive: true });
        return tmpDir;
    }

    /** Remove the temp workspace after execution */
    private async cleanupWorkspace(workspaceDir: string): Promise<void> {
        try {
            await fs.rm(workspaceDir, { recursive: true, force: true });
        } catch (error) {
            console.error('Failed to cleanup workspace:', error);
        }
    }

    /** Compile Solution.java and Runner.java; returns compilation errors if any */
    private async compile(workspaceDir: string): Promise<{ success: boolean; error?: string; compilationErrors?: CompilationError[] }> {
        // Compilation needs a writable workspace so javac can emit .class files beside the sources.
        const result = await this.sandboxRunner.execute({
            command: 'javac',
            args: ['Solution.java', 'Runner.java'],
            cwd: workspaceDir,
            timeoutMs: COMPILE_TIMEOUT_MS,
            image: JAVA_SANDBOX_IMAGE,
            writableWorkspace: true,
        });

        if (result.exitCode !== 0) {
            const compilationErrors = this.parseJavaCompilationErrors(result.stderr);
            return {
                success: false,
                error: result.stderr || 'Compilation failed',
                compilationErrors,
            };
        }

        return { success: true };
    }

    /** Run one testcase through Runner.java and separate user logs from the JSON answer. */
    private async runTestcase(
        workspaceDir: string,
        testcase: Testcase
    ): Promise<{ result: TestcaseResult; debugOutput: string }> {
        const startTime = Date.now();
        const inputJson = JSON.stringify(testcase.input);

        // Runtime uses the same workspace read-only; compiled classes already exist after compile().
        const result = await this.sandboxRunner.execute({
            command: 'java',
            args: ['Runner'],
            cwd: workspaceDir,
            timeoutMs: TESTCASE_TIMEOUT_MS,
            stdin: inputJson,
            image: JAVA_SANDBOX_IMAGE,
            writableWorkspace: false,
        });
        const executionTime = Date.now() - startTime;

        // User println output is allowed before the separator; only the suffix is parsed as JSON.
        let debugOutput = '';
        let jsonOutput = result.stdout;
        const separatorIndex = result.stdout.indexOf(RESULT_SEPARATOR);
        if (separatorIndex !== -1) {
            debugOutput = result.stdout.substring(0, separatorIndex).trim();
            jsonOutput = result.stdout.substring(separatorIndex + RESULT_SEPARATOR.length).trim();
        }

        // Treat either the child_process timeout flag or elapsed time boundary as TLE.
        if (result.exitCode === -1 || executionTime >= TESTCASE_TIMEOUT_MS) {
            return {
                result: {
                    index: 0,
                    status: 'Timeout',
                    input: testcase.input,
                    expected: testcase.output,
                    executionTime,
                },
                debugOutput,
            };
        }

        // Runtime failures surface stderr and skip JSON parsing.
        if (result.exitCode !== 0) {
            return {
                result: {
                    index: 0,
                    status: 'Error',
                    input: testcase.input,
                    expected: testcase.output,
                    errorMessage: result.stderr || 'Runtime error',
                    executionTime,
                },
                debugOutput,
            };
        }

        // Runner must emit {"result": ...}; malformed output is a runtime-style error.
        try {
            const parsed = JSON.parse(jsonOutput);
            const actual = parsed.result;

            // Expected values are stored as JSON-compatible data, so structural stringify compare is enough here.
            const isCorrect = this.compareOutputs(testcase.output, actual);

            return {
                result: {
                    index: 0,
                    status: isCorrect ? 'Passed' : 'Failed',
                    input: testcase.input,
                    expected: testcase.output,
                    actual,
                    executionTime,
                },
                debugOutput,
            };
        } catch (error) {
            return {
                result: {
                    index: 0,
                    status: 'Error',
                    input: testcase.input,
                    expected: testcase.output,
                    errorMessage: 'Failed to parse output: ' + result.stdout,
                    executionTime,
                },
                debugOutput,
            };
        }
    }

    /** Deep-compare expected vs actual output using JSON serialization. */
    private compareOutputs(expected: unknown, actual: unknown): boolean {
        return JSON.stringify(expected) === JSON.stringify(actual);
    }

    /** Parse javac error output into structured CompilationError objects */
    private parseJavaCompilationErrors(stderr: string): CompilationError[] {
        const errors: CompilationError[] = [];
        // Java error format: "Solution.java:3: error: cannot find symbol".
        const errorRegex = /^(.+?\.java):(\d+):\s*(error|warning):\s*(.+)$/gm;
        let match;

        while ((match = errorRegex.exec(stderr)) !== null) {
            const [, file, lineStr, severity, message] = match;
            const line = parseInt(lineStr, 10);

            errors.push({
                file: path.basename(file),  // Monaco only needs the displayed filename.
                line,
                column: 1,  // javac does not always provide a stable column for every diagnostic.
                message: message.trim(),
                severity: severity as 'error' | 'warning',
            });
        }

        return errors;
    }

    /** Main entry: compile user code, run all testcases, and aggregate results */
    async executeCode(
        userCode: string,
        testcases: Testcase[],
        showHiddenInputs: boolean = true,
        metadata?: ProblemMetadata,
        visibleTestcaseCount: number = testcases.length
    ): Promise<{
        status: 'AC' | 'WA' | 'CE' | 'RE' | 'TLE';
        message?: string;
        testcaseResults: TestcaseResult[];
        totalTestcases: number;
        passedTestcases: number;
        compilationErrors?: CompilationError[];
        debugOutput?: string;
    }> {
        const workspaceDir = await this.createTempWorkspace();
        const hiddenStartIndex = Math.max(0, Math.min(visibleTestcaseCount, testcases.length));

        try {
            // Solution.java is the only user-controlled source file compiled with the generated runner.
            await fs.writeFile(path.join(workspaceDir, 'Solution.java'), userCode);

            // Runner.java adapts metadata-defined params/return type to the user's LeetCode-style method.
            const runnerCode = this.getRunnerTemplate(metadata);
            await fs.writeFile(path.join(workspaceDir, 'Runner.java'), runnerCode);

            // Compile both files together so signature mismatches are reported before execution.
            const compileResult = await this.compile(workspaceDir);
            if (!compileResult.success) {
                return {
                    status: 'CE',
                    message: compileResult.error,
                    testcaseResults: [],
                    totalTestcases: testcases.length,
                    passedTestcases: 0,
                    compilationErrors: compileResult.compilationErrors || [],
                };
            }

            // Run sequentially to keep per-case debug output ordered and easy to attribute.
            const results: TestcaseResult[] = [];
            const debugOutputs: string[] = [];
            let passed = 0;
            let firstFailure: TestcaseResult | null = null;
            let firstHiddenFailure: TestcaseResult | null = null;

            for (let i = 0; i < testcases.length; i++) {
                const { result, debugOutput } = await this.runTestcase(workspaceDir, testcases[i]);
                result.index = i + 1;

                // Include testcase labels now because stdout from different cases is combined later.
                if (debugOutput) {
                    debugOutputs.push(`[Testcase ${i + 1}]\n${debugOutput}`);
                }

                // On submit, hide hidden inputs while still counting every hidden pass/fail.
                if (!showHiddenInputs && i >= hiddenStartIndex) {
                    // Do not add passing hidden cases to the visible result list.
                    if (result.status === 'Passed') {
                        passed++;
                    } else {
                        if (!firstFailure) {
                            firstFailure = result;
                        }
                        // Preserve one failing hidden case so users get a concrete failure signal.
                        if (!firstHiddenFailure) {
                            firstHiddenFailure = result;
                        }
                    }
                } else {
                    // Visible cases can safely show input, expected, actual, and timing.
                    results.push(result);
                    if (result.status === 'Passed') {
                        passed++;
                    } else if (!firstFailure) {
                        firstFailure = result;
                    }
                }
            }

            // Reveal only the first hidden failure object; callers already decided whether hidden inputs are allowed.
            if (firstHiddenFailure && !showHiddenInputs) {
                results.push(firstHiddenFailure);
            }

            // Overall status is based on the earliest failure, matching judge-style feedback.
            let status: 'AC' | 'WA' | 'RE' | 'TLE' = 'AC';
            let message = '';

            if (passed === testcases.length) {
                status = 'AC';
                message = 'Accepted';
            } else if (firstFailure) {
                if (firstFailure.status === 'Timeout') {
                    status = 'TLE';
                    message = `Time Limit Exceeded on testcase ${firstFailure.index}`;
                } else if (firstFailure.status === 'Error') {
                    status = 'RE';
                    message = `Runtime Error on testcase ${firstFailure.index}: ${firstFailure.errorMessage}`;
                } else {
                    status = 'WA';
                    message = `Wrong Answer on testcase ${firstFailure.index}`;
                }
            }

            return {
                status,
                message,
                testcaseResults: results,
                totalTestcases: testcases.length,
                passedTestcases: passed,
                debugOutput: debugOutputs.length > 0 ? debugOutputs.join('\n\n') : undefined,
            };
        } finally {
            // Always remove generated source, class files, and testcase input files.
            await this.cleanupWorkspace(workspaceDir);
        }
    }

    // Map internal/LeetCode type strings to Java declarations understood by getParseCode().
    private mapTypeToJava(typeStr: string): string {
        const t = typeStr.toLowerCase().trim();
        // Default keeps imported metadata visible but may require a future parser extension.
        return JAVA_TYPE_MAP[t] ?? typeStr;
    }

    // Generate the Java statement that converts parsed JSON into the target method parameter type.
    private getParseCode(paramName: string, javaType: string): string {
        switch (javaType) {
            case 'int':
                return `        int ${paramName} = ((Number) data.get("${paramName}")).intValue();`;
            case 'long':
                return `        long ${paramName} = ((Number) data.get("${paramName}")).longValue();`;
            case 'double':
                return `        double ${paramName} = ((Number) data.get("${paramName}")).doubleValue();`;
            case 'boolean':
                return `        boolean ${paramName} = (Boolean) data.get("${paramName}");`;
            case 'String':
                return `        String ${paramName} = (String) data.get("${paramName}");`;
            case 'char':
                return `        char ${paramName} = ((String) data.get("${paramName}")).charAt(0);`;
            case 'int[]':
                return `        int[] ${paramName} = toIntArray((java.util.List<?>) data.get("${paramName}"));`;
            case 'long[]':
                return `        long[] ${paramName} = toLongArray((java.util.List<?>) data.get("${paramName}"));`;
            case 'double[]':
                return `        double[] ${paramName} = toDoubleArray((java.util.List<?>) data.get("${paramName}"));`;
            case 'boolean[]':
                return `        boolean[] ${paramName} = toBooleanArray((java.util.List<?>) data.get("${paramName}"));`;
            case 'String[]':
                return `        String[] ${paramName} = toStringArray((java.util.List<?>) data.get("${paramName}"));`;
            case 'char[]':
                return `        char[] ${paramName} = toCharArray((java.util.List<?>) data.get("${paramName}"));`;
            case 'int[][]':
                return `        int[][] ${paramName} = toInt2DArray((java.util.List<?>) data.get("${paramName}"));`;
            case 'char[][]':
                return `        char[][] ${paramName} = toChar2DArray((java.util.List<?>) data.get("${paramName}"));`;
            case 'String[][]':
                return `        String[][] ${paramName} = toString2DArray((java.util.List<?>) data.get("${paramName}"));`;
            case 'List<Integer>':
                return `        List<Integer> ${paramName} = toIntegerList((java.util.List<?>) data.get("${paramName}"));`;
            case 'List<String>':
                return `        List<String> ${paramName} = toStringList((java.util.List<?>) data.get("${paramName}"));`;
            case 'List<List<Integer>>':
                return `        List<List<Integer>> ${paramName} = toIntegerListList((java.util.List<?>) data.get("${paramName}"));`;
            case 'List<List<String>>':
                return `        List<List<String>> ${paramName} = toStringListList((java.util.List<?>) data.get("${paramName}"));`;
            case 'List<Boolean>':
                return `        List<Boolean> ${paramName} = toBooleanList((java.util.List<?>) data.get("${paramName}"));`;
            default:
                return `        // Unsupported type: ${javaType} for ${paramName}
        Object ${paramName} = data.get("${paramName}");`;
        }
    }

    // Generate an expression that serializes the Java return value back into JSON.
    private getSerializeCode(javaType: string): string {
        switch (javaType) {
            case 'int':
            case 'long':
            case 'double':
            case 'boolean':
                return `String.valueOf(result)`;
            case 'String':
                return `"\\"" + result.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"") + "\\""`;
            case 'char':
                return `"\\"" + result + "\\""`;
            case 'int[]':
            case 'long[]':
            case 'double[]':
                return `arrayToJson(result)`;
            case 'boolean[]':
                return `boolArrayToJson(result)`;
            case 'String[]':
                return `stringArrayToJson(result)`;
            case 'char[]':
                return `charArrayToJson(result)`;
            case 'int[][]':
                return `array2DToJson(result)`;
            case 'char[][]':
                return `char2DArrayToJson(result)`;
            case 'String[][]':
                return `string2DArrayToJson(result)`;
            case 'List<Integer>':
            case 'List<String>':
            case 'List<Boolean>':
                return `listToJson(result)`;
            case 'List<List<Integer>>':
            case 'List<List<String>>':
                return `listListToJson(result)`;
            default:
                return `String.valueOf(result)`;
        }
    }

    /** Generate the Runner.java harness based on problem metadata (params, return type) */
    private getRunnerTemplate(metadata?: ProblemMetadata): string {
        // Fallback keeps older bundled problems runnable even if they lack imported metadata fields.
        if (!metadata?.functionName || !metadata?.params || !metadata?.returnType) {
            console.warn('Missing problem metadata (functionName/params/returnType); using hardcoded defaults');
        }
        const functionName = metadata?.functionName || 'sortArray';
        const params = metadata?.params || [{ name: 'nums', type: 'int[]' }];
        const returnType = this.mapTypeToJava(metadata?.returnType || 'int[]');

        // These snippets are injected into Runner.java, not evaluated in TypeScript.
        const parseLines = params.map(p => this.getParseCode(p.name, this.mapTypeToJava(p.type))).join('\n');
        const argsList = params.map(p => p.name).join(', ');
        const serializeExpr = this.getSerializeCode(returnType);

        return `import java.util.*;

public class Runner {
    public static void main(String[] args) {
        try {
            Scanner scanner = new Scanner(System.in);
            StringBuilder inputBuilder = new StringBuilder();
            while (scanner.hasNextLine()) {
                inputBuilder.append(scanner.nextLine());
            }
            scanner.close();
            
            String inputJson = inputBuilder.toString().trim();
            
            // This lightweight parser only targets JSON shapes produced by JustCode testcases.
            java.util.Map<String, Object> data = parseJson(inputJson);
            
            // Convert metadata-defined fields into the exact method parameter types.
${parseLines}
            
            Solution solution = new Solution();
            ${returnType} result = solution.${functionName}(${argsList});
            
            // Keep user debug output before this marker so the TypeScript executor can split it safely.
            System.out.println("===RESULT_JSON_START===");
            
            // Emit one JSON object so the executor can compare the result structurally.
            System.out.print("{\\"result\\":");
            System.out.print(${serializeExpr});
            System.out.println("}");
            
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
    
    // ======================== JSON Parser ========================
    // Minimal parser for numbers, strings, booleans, null, arrays, and nested objects.
    // It is intentionally local to avoid adding runtime dependencies to generated workspaces.
    
    @SuppressWarnings("unchecked")
    static java.util.Map<String, Object> parseJson(String json) {
        json = json.trim();
        if (!json.startsWith("{") || !json.endsWith("}")) {
            throw new RuntimeException("Invalid JSON object");
        }
        java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
        json = json.substring(1, json.length() - 1).trim();
        if (json.isEmpty()) return map;
        
        int i = 0;
        while (i < json.length()) {
            // Skip whitespace between object members.
            while (i < json.length() && Character.isWhitespace(json.charAt(i))) i++;
            
            // Parse object key. Escaped quotes are not expected in testcase parameter names.
            if (json.charAt(i) != '"') break;
            i++; // skip opening quote
            int keyStart = i;
            while (i < json.length() && json.charAt(i) != '"') i++;
            String key = json.substring(keyStart, i);
            i++; // skip closing quote
            
            // Move past the key/value separator.
            while (i < json.length() && Character.isWhitespace(json.charAt(i))) i++;
            i++; // skip colon
            while (i < json.length() && Character.isWhitespace(json.charAt(i))) i++;
            
            // Parse the value and receive the next unread index.
            Object[] valueAndEnd = parseJsonValue(json, i);
            map.put(key, valueAndEnd[0]);
            i = (Integer) valueAndEnd[1];
            
            // Move to the next member, if any.
            while (i < json.length() && (Character.isWhitespace(json.charAt(i)) || json.charAt(i) == ',')) i++;
        }
        return map;
    }
    
    static Object[] parseJsonValue(String json, int start) {
        char c = json.charAt(start);
        if (c == '"') {
            // String
            int i = start + 1;
            StringBuilder sb = new StringBuilder();
            while (i < json.length()) {
                char ch = json.charAt(i);
                if (ch == '\\\\') {
                    i++;
                    sb.append(json.charAt(i));
                } else if (ch == '"') {
                    break;
                } else {
                    sb.append(ch);
                }
                i++;
            }
            return new Object[]{sb.toString(), i + 1};
        } else if (c == '[') {
            // Array
            java.util.List<Object> list = new java.util.ArrayList<>();
            int i = start + 1;
            while (i < json.length()) {
                while (i < json.length() && Character.isWhitespace(json.charAt(i))) i++;
                if (json.charAt(i) == ']') { i++; break; }
                Object[] valueAndEnd = parseJsonValue(json, i);
                list.add(valueAndEnd[0]);
                i = (Integer) valueAndEnd[1];
                while (i < json.length() && (Character.isWhitespace(json.charAt(i)) || json.charAt(i) == ',')) i++;
            }
            return new Object[]{list, i};
        } else if (c == '{') {
            // Nested object
            int depth = 1;
            int i = start + 1;
            while (i < json.length() && depth > 0) {
                if (json.charAt(i) == '{') depth++;
                else if (json.charAt(i) == '}') depth--;
                i++;
            }
            String nestedJson = json.substring(start, i);
            return new Object[]{parseJson(nestedJson), i};
        } else if (c == 't' || c == 'f') {
            // Boolean
            if (json.startsWith("true", start)) return new Object[]{true, start + 4};
            else return new Object[]{false, start + 5};
        } else if (c == 'n') {
            // Null
            return new Object[]{null, start + 4};
        } else {
            // Number
            int i = start;
            while (i < json.length() && (Character.isDigit(json.charAt(i)) || json.charAt(i) == '-' || json.charAt(i) == '.' || json.charAt(i) == 'e' || json.charAt(i) == 'E' || json.charAt(i) == '+')) i++;
            String numStr = json.substring(start, i);
            if (numStr.contains(".") || numStr.contains("e") || numStr.contains("E")) {
                return new Object[]{Double.parseDouble(numStr), i};
            } else {
                long val = Long.parseLong(numStr);
                if (val >= Integer.MIN_VALUE && val <= Integer.MAX_VALUE) {
                    return new Object[]{(int) val, i};
                }
                return new Object[]{val, i};
            }
        }
    }
    
    // ======================== Type Converters ========================
    
    static int[] toIntArray(java.util.List<?> list) {
        int[] arr = new int[list.size()];
        for (int i = 0; i < list.size(); i++) arr[i] = ((Number) list.get(i)).intValue();
        return arr;
    }
    
    static long[] toLongArray(java.util.List<?> list) {
        long[] arr = new long[list.size()];
        for (int i = 0; i < list.size(); i++) arr[i] = ((Number) list.get(i)).longValue();
        return arr;
    }
    
    static double[] toDoubleArray(java.util.List<?> list) {
        double[] arr = new double[list.size()];
        for (int i = 0; i < list.size(); i++) arr[i] = ((Number) list.get(i)).doubleValue();
        return arr;
    }
    
    static boolean[] toBooleanArray(java.util.List<?> list) {
        boolean[] arr = new boolean[list.size()];
        for (int i = 0; i < list.size(); i++) arr[i] = (Boolean) list.get(i);
        return arr;
    }
    
    static String[] toStringArray(java.util.List<?> list) {
        String[] arr = new String[list.size()];
        for (int i = 0; i < list.size(); i++) arr[i] = (String) list.get(i);
        return arr;
    }
    
    static char[] toCharArray(java.util.List<?> list) {
        char[] arr = new char[list.size()];
        for (int i = 0; i < list.size(); i++) arr[i] = ((String) list.get(i)).charAt(0);
        return arr;
    }
    
    static int[][] toInt2DArray(java.util.List<?> list) {
        int[][] arr = new int[list.size()][];
        for (int i = 0; i < list.size(); i++) {
            arr[i] = toIntArray((java.util.List<?>) list.get(i));
        }
        return arr;
    }
    
    static char[][] toChar2DArray(java.util.List<?> list) {
        char[][] arr = new char[list.size()][];
        for (int i = 0; i < list.size(); i++) {
            arr[i] = toCharArray((java.util.List<?>) list.get(i));
        }
        return arr;
    }
    
    static String[][] toString2DArray(java.util.List<?> list) {
        String[][] arr = new String[list.size()][];
        for (int i = 0; i < list.size(); i++) {
            arr[i] = toStringArray((java.util.List<?>) list.get(i));
        }
        return arr;
    }
    
    static List<Integer> toIntegerList(java.util.List<?> list) {
        List<Integer> result = new ArrayList<>(list.size());
        for (Object o : list) result.add(((Number) o).intValue());
        return result;
    }
    
    static List<String> toStringList(java.util.List<?> list) {
        List<String> result = new ArrayList<>(list.size());
        for (Object o : list) result.add((String) o);
        return result;
    }
    
    static List<Boolean> toBooleanList(java.util.List<?> list) {
        List<Boolean> result = new ArrayList<>(list.size());
        for (Object o : list) result.add((Boolean) o);
        return result;
    }
    
    static List<List<Integer>> toIntegerListList(java.util.List<?> list) {
        List<List<Integer>> result = new ArrayList<>(list.size());
        for (Object o : list) result.add(toIntegerList((java.util.List<?>) o));
        return result;
    }
    
    static List<List<String>> toStringListList(java.util.List<?> list) {
        List<List<String>> result = new ArrayList<>(list.size());
        for (Object o : list) result.add(toStringList((java.util.List<?>) o));
        return result;
    }
    
    // ======================== Serializers ========================
    
    static String arrayToJson(int[] arr) {
        if (arr.length == 0) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(arr[i]);
        }
        sb.append("]");
        return sb.toString();
    }
    
    static String arrayToJson(long[] arr) {
        if (arr.length == 0) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(arr[i]);
        }
        sb.append("]");
        return sb.toString();
    }
    
    static String arrayToJson(double[] arr) {
        if (arr.length == 0) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(arr[i]);
        }
        sb.append("]");
        return sb.toString();
    }
    
    static String boolArrayToJson(boolean[] arr) {
        if (arr.length == 0) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(arr[i]);
        }
        sb.append("]");
        return sb.toString();
    }
    
    static String stringArrayToJson(String[] arr) {
        if (arr.length == 0) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append("\\"").append(arr[i].replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"")).append("\\"");
        }
        sb.append("]");
        return sb.toString();
    }
    
    static String charArrayToJson(char[] arr) {
        if (arr.length == 0) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append("\\"").append(arr[i]).append("\\"");
        }
        sb.append("]");
        return sb.toString();
    }
    
    static String array2DToJson(int[][] arr) {
        if (arr.length == 0) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(arrayToJson(arr[i]));
        }
        sb.append("]");
        return sb.toString();
    }
    
    static String char2DArrayToJson(char[][] arr) {
        if (arr.length == 0) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(charArrayToJson(arr[i]));
        }
        sb.append("]");
        return sb.toString();
    }
    
    static String string2DArrayToJson(String[][] arr) {
        if (arr.length == 0) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(stringArrayToJson(arr[i]));
        }
        sb.append("]");
        return sb.toString();
    }
    
    @SuppressWarnings("unchecked")
    static String listToJson(java.util.List<?> list) {
        if (list.isEmpty()) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) sb.append(",");
            Object item = list.get(i);
            if (item instanceof String) {
                sb.append("\\"").append(((String) item).replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"")).append("\\"");
            } else if (item instanceof Boolean) {
                sb.append(item);
            } else {
                sb.append(item);
            }
        }
        sb.append("]");
        return sb.toString();
    }
    
    @SuppressWarnings("unchecked")
    static String listListToJson(java.util.List<?> list) {
        if (list.isEmpty()) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append(listToJson((java.util.List<?>) list.get(i)));
        }
        sb.append("]");
        return sb.toString();
    }
}`;
    }
}
