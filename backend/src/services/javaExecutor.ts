/**
 * Java Executor：在隔離的暫存 workspace 中編譯並執行 Java 程式碼。
 * 產生 Runner.java harness，針對支援的題目 metadata 型別處理 JSON I/O、
 * 測試案例解析與結果序列化。
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Testcase, TestcaseResult, CompilationError, ProblemMetadata } from '../types';
import { RESULT_SEPARATOR, TESTCASE_TIMEOUT_MS, COMPILE_TIMEOUT_MS, JAVA_SANDBOX_IMAGE } from '../constants';
import { SandboxRunner } from './sandboxRunner';

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

    /** 為每次執行建立專屬 workspace，避免使用者檔案/class 在不同執行間衝突。 */
    private async createTempWorkspace(): Promise<string> {
        const tmpDir = path.join(process.cwd(), 'temp', uuidv4());
        await fs.mkdir(tmpDir, { recursive: true });
        return tmpDir;
    }

    /** 執行後移除暫存 workspace。 */
    private async cleanupWorkspace(workspaceDir: string): Promise<void> {
        try {
            await fs.rm(workspaceDir, { recursive: true, force: true });
        } catch (error) {
            console.error('Failed to cleanup workspace:', error);
        }
    }

    /** 編譯 Solution.java 與 Runner.java；若有錯誤則回傳 compilation errors。 */
    private async compile(workspaceDir: string): Promise<{ success: boolean; error?: string; compilationErrors?: CompilationError[] }> {
        // 編譯需要可寫 workspace，讓 javac 可在 source 旁輸出 .class 檔案。
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

    /** 透過 Runner.java 執行單一測試案例，並將使用者日誌與 JSON 答案分離。 */
    private async runTestcase(
        workspaceDir: string,
        testcase: Testcase
    ): Promise<{ result: TestcaseResult; debugOutput: string }> {
        const startTime = Date.now();
        const inputJson = JSON.stringify(testcase.input);

        // 執行期以唯讀方式使用同一 workspace；compiled classes 已在 compile() 後存在。
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

        // separator 前允許使用者 println 輸出；只有後綴會被解析為 JSON。
        let debugOutput = '';
        let jsonOutput = result.stdout;
        const separatorIndex = result.stdout.indexOf(RESULT_SEPARATOR);
        if (separatorIndex !== -1) {
            debugOutput = result.stdout.substring(0, separatorIndex).trim();
            jsonOutput = result.stdout.substring(separatorIndex + RESULT_SEPARATOR.length).trim();
        }

        // child_process timeout 旗標或經過時間邊界任一成立都視為 TLE。
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

        // 執行期失敗會呈現 stderr，並略過 JSON 解析。
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

        // Runner 必須輸出 {"result": ...}；格式錯誤視為執行期類型錯誤。
        try {
            const parsed = JSON.parse(jsonOutput);
            const actual = parsed.result;

            // 預期值以 JSON 相容資料儲存，因此這裡使用結構化 stringify 比對即可。
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

    /** 使用 JSON 序列化深度比對預期輸出與實際輸出。 */
    private compareOutputs(expected: unknown, actual: unknown): boolean {
        return JSON.stringify(expected) === JSON.stringify(actual);
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

    /** 主要入口：編譯使用者程式碼、執行所有測試案例，並彙整結果。 */
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
            // Solution.java 是唯一會與產生的 runner 一起編譯的使用者可控 source 檔案。
            await fs.writeFile(path.join(workspaceDir, 'Solution.java'), userCode);

            // Runner.java 會將 metadata 定義的 params/return type 接到使用者 LeetCode 風格 method。
            const runnerCode = this.getRunnerTemplate(metadata);
            await fs.writeFile(path.join(workspaceDir, 'Runner.java'), runnerCode);

            // 一起編譯兩個檔案，讓 signature 不符能在執行前回報。
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

            // 依序執行以保持每個案例的除錯輸出有序且易於歸因。
            const results: TestcaseResult[] = [];
            const debugOutputs: string[] = [];
            let passed = 0;
            let firstFailure: TestcaseResult | null = null;
            let firstHiddenFailure: TestcaseResult | null = null;

            for (let i = 0; i < testcases.length; i++) {
                const { result, debugOutput } = await this.runTestcase(workspaceDir, testcases[i]);
                result.index = i + 1;

                // 因為不同案例的 stdout 稍後會合併，所以現在先加入測試案例標籤。
                if (debugOutput) {
                    debugOutputs.push(`[Testcase ${i + 1}]\n${debugOutput}`);
                }

                // Submit 時隱藏隱藏輸入，但仍計算每個隱藏案例通過/失敗。
                if (!showHiddenInputs && i >= hiddenStartIndex) {
                    // 通過的隱藏案例不加入可見結果列表。
                    if (result.status === 'Passed') {
                        passed++;
                    } else {
                        if (!firstFailure) {
                            firstFailure = result;
                        }
                        // 保留一個失敗的隱藏案例，讓使用者取得具體失敗訊號。
                        if (!firstHiddenFailure) {
                            firstHiddenFailure = result;
                        }
                    }
                } else {
                    // 可見案例可安全顯示輸入、預期值、實際值與計時。
                    results.push(result);
                    if (result.status === 'Passed') {
                        passed++;
                    } else if (!firstFailure) {
                        firstFailure = result;
                    }
                }
            }

            // 只揭露第一個隱藏失敗物件；呼叫端已決定是否允許顯示隱藏輸入。
            if (firstHiddenFailure && !showHiddenInputs) {
                results.push(firstHiddenFailure);
            }

            // 整體狀態依最早失敗決定，符合評測器風格回饋。
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
            // 一律移除產生的原始檔、class files 與測試案例輸入檔。
            await this.cleanupWorkspace(workspaceDir);
        }
    }

    // 將 internal/LeetCode type string 映射到 getParseCode() 可理解的 Java 宣告。
    private mapTypeToJava(typeStr: string): string {
        const t = typeStr.toLowerCase().trim();
        // 預設值會保留匯入 metadata 可見性，但未來可能需要擴充 parser。
        return JAVA_TYPE_MAP[t] ?? typeStr;
    }

    // 產生 Java statement，將已解析 JSON 轉成目標 method parameter type。
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
                return `        // 不支援的型別：${javaType}，參數 ${paramName}
        Object ${paramName} = data.get("${paramName}");`;
        }
    }

    // 產生 expression，將 Java 回傳值序列化回 JSON。
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

    /** 依題目 metadata（params、return type）產生 Runner.java 執行包裝。 */
    private getRunnerTemplate(metadata?: ProblemMetadata): string {
        // 即使舊版內建題目缺少匯入 metadata 欄位，備援值仍可讓它們執行。
        if (!metadata?.functionName || !metadata?.params || !metadata?.returnType) {
            console.warn('Missing problem metadata (functionName/params/returnType); using hardcoded defaults');
        }
        const functionName = metadata?.functionName || 'sortArray';
        const params = metadata?.params || [{ name: 'nums', type: 'int[]' }];
        const returnType = this.mapTypeToJava(metadata?.returnType || 'int[]');

        // 這些片段會注入 Runner.java，不會在 TypeScript 中求值。
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
            
            // 這個輕量 parser 只針對 JustCode 測試案例產生的 JSON 形狀。
            java.util.Map<String, Object> data = parseJson(inputJson);
            
            // 將 metadata 定義的欄位轉成精確的方法參數型別。
${parseLines}
            
            Solution solution = new Solution();
            ${returnType} result = solution.${functionName}(${argsList});
            
            // 將使用者除錯輸出保留在此 marker 前方，讓 TypeScript executor 可安全切分。
            System.out.println("===RESULT_JSON_START===");
            
            // 輸出單一 JSON 物件，讓 executor 可用結構化方式比對結果。
            System.out.print("{\\"result\\":");
            System.out.print(${serializeExpr});
            System.out.println("}");
            
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
    
    // ======================== JSON 解析器 ========================
    // 支援數字、字串、布林值、null、陣列與巢狀物件的最小 parser。
    // 刻意放在本地，避免為產生的 workspace 增加執行期依賴。
    
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
            // 略過物件成員之間的空白。
            while (i < json.length() && Character.isWhitespace(json.charAt(i))) i++;
            
            // 解析物件 key；測試案例參數名稱不預期出現 escaped quotes。
            if (json.charAt(i) != '"') break;
            i++; // 略過開頭 quote
            int keyStart = i;
            while (i < json.length() && json.charAt(i) != '"') i++;
            String key = json.substring(keyStart, i);
            i++; // 略過結尾 quote
            
            // 移過鍵/值分隔符。
            while (i < json.length() && Character.isWhitespace(json.charAt(i))) i++;
            i++; // 略過 colon
            while (i < json.length() && Character.isWhitespace(json.charAt(i))) i++;
            
            // 解析值，並取得下一個尚未讀取的索引。
            Object[] valueAndEnd = parseJsonValue(json, i);
            map.put(key, valueAndEnd[0]);
            i = (Integer) valueAndEnd[1];
            
            // 若有下一個 member，移動到該位置。
            while (i < json.length() && (Character.isWhitespace(json.charAt(i)) || json.charAt(i) == ',')) i++;
        }
        return map;
    }
    
    static Object[] parseJsonValue(String json, int start) {
        char c = json.charAt(start);
        if (c == '"') {
            // 字串
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
            // 陣列
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
            // 巢狀物件
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
            // 布林值
            if (json.startsWith("true", start)) return new Object[]{true, start + 4};
            else return new Object[]{false, start + 5};
        } else if (c == 'n') {
            // Null
            return new Object[]{null, start + 4};
        } else {
            // 數字
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
    
    // ======================== 型別轉換器 ========================
    
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
    
    // ======================== 序列化器 ========================
    
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
