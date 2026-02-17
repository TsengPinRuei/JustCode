import { exec } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Testcase, TestcaseResult, CompilationError, ProblemMetadata } from '../types';
import { RESULT_SEPARATOR, TESTCASE_TIMEOUT_MS, MAX_OUTPUT_LENGTH, COMPILE_TIMEOUT_MS } from '../constants';

export class JavaExecutor {
    private async createTempWorkspace(): Promise<string> {
        const tmpDir = path.join(process.cwd(), 'temp', uuidv4());
        await fs.mkdir(tmpDir, { recursive: true });
        return tmpDir;
    }

    private async cleanupWorkspace(workspaceDir: string): Promise<void> {
        try {
            await fs.rm(workspaceDir, { recursive: true, force: true });
        } catch (error) {
            console.error('Failed to cleanup workspace:', error);
        }
    }

    private executeCommand(
        command: string,
        cwd: string,
        timeoutMs: number
    ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        return new Promise((resolve) => {
            const process = exec(
                command,
                {
                    cwd,
                    timeout: timeoutMs,
                    maxBuffer: MAX_OUTPUT_LENGTH,
                },
                (error, stdout, stderr) => {
                    if (error) {
                        if (error.killed || error.signal === 'SIGTERM') {
                            // Timeout
                            resolve({ stdout: '', stderr: 'Time Limit Exceeded', exitCode: -1 });
                        } else {
                            // Runtime error or compilation error
                            resolve({ stdout, stderr, exitCode: error.code || 1 });
                        }
                    } else {
                        resolve({ stdout, stderr, exitCode: 0 });
                    }
                }
            );
        });
    }

    private async compile(workspaceDir: string): Promise<{ success: boolean; error?: string; compilationErrors?: CompilationError[] }> {
        const compileCommand = 'javac Solution.java Runner.java';
        const result = await this.executeCommand(compileCommand, workspaceDir, COMPILE_TIMEOUT_MS);

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

    private async runTestcase(
        workspaceDir: string,
        testcase: Testcase
    ): Promise<{ result: TestcaseResult; debugOutput: string }> {
        const startTime = Date.now();
        const inputJson = JSON.stringify(testcase.input);

        // Write input to temp file
        const inputFile = path.join(workspaceDir, 'input.txt');
        await fs.writeFile(inputFile, inputJson);

        const runCommand = `java Runner < input.txt`;
        const result = await this.executeCommand(runCommand, workspaceDir, TESTCASE_TIMEOUT_MS);
        const executionTime = Date.now() - startTime;

        // Parse output - separate debug output from result JSON
        let debugOutput = '';
        let jsonOutput = result.stdout;
        const separatorIndex = result.stdout.indexOf(RESULT_SEPARATOR);
        if (separatorIndex !== -1) {
            debugOutput = result.stdout.substring(0, separatorIndex).trim();
            jsonOutput = result.stdout.substring(separatorIndex + RESULT_SEPARATOR.length).trim();
        }

        // Check for timeout
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

        // Check for runtime error
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

        // Parse JSON output
        try {
            const parsed = JSON.parse(jsonOutput);
            const actual = parsed.result;

            // Deep compare outputs
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

    private compareOutputs(expected: unknown, actual: unknown): boolean {
        return JSON.stringify(expected) === JSON.stringify(actual);
    }

    private parseJavaCompilationErrors(stderr: string): CompilationError[] {
        const errors: CompilationError[] = [];
        // Java error format: "Solution.java:3: error: cannot find symbol"
        const errorRegex = /^(.+?\.java):(\d+):\s*(error|warning):\s*(.+)$/gm;
        let match;

        while ((match = errorRegex.exec(stderr)) !== null) {
            const [, file, lineStr, severity, message] = match;
            const line = parseInt(lineStr, 10);

            errors.push({
                file: path.basename(file),  // Extract just the filename
                line,
                column: 1,  // Java compiler doesn't always provide column info
                message: message.trim(),
                severity: severity as 'error' | 'warning',
            });
        }

        return errors;
    }

    async executeCode(
        userCode: string,
        testcases: Testcase[],
        showHiddenInputs: boolean = true,
        metadata?: ProblemMetadata
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

        try {
            // Write user solution
            await fs.writeFile(path.join(workspaceDir, 'Solution.java'), userCode);

            // Write Runner template
            const runnerCode = this.getRunnerTemplate(metadata);
            await fs.writeFile(path.join(workspaceDir, 'Runner.java'), runnerCode);

            // Compile
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

            // Run all testcases
            const results: TestcaseResult[] = [];
            const debugOutputs: string[] = [];
            let passed = 0;
            let firstFailure: TestcaseResult | null = null;
            let firstHiddenFailure: TestcaseResult | null = null;

            for (let i = 0; i < testcases.length; i++) {
                const { result, debugOutput } = await this.runTestcase(workspaceDir, testcases[i]);
                result.index = i + 1;

                // Collect debug output
                if (debugOutput) {
                    debugOutputs.push(`[Testcase ${i + 1}]\n${debugOutput}`);
                }

                // For hidden testcases (index >= 3), don't include detailed results when submitting
                if (!showHiddenInputs && i >= 3) {
                    // Only track pass/fail, don't add to results array
                    if (result.status === 'Passed') {
                        passed++;
                    } else {
                        if (!firstFailure) {
                            firstFailure = result;
                        }
                        // Track first hidden testcase failure for debugging
                        if (!firstHiddenFailure) {
                            firstHiddenFailure = result;
                        }
                    }
                } else {
                    // For visible testcases, include full details
                    results.push(result);
                    if (result.status === 'Passed') {
                        passed++;
                    } else if (!firstFailure) {
                        firstFailure = result;
                    }
                }
            }

            // If there's a hidden testcase failure, add it to results for debugging
            if (firstHiddenFailure && !showHiddenInputs) {
                results.push(firstHiddenFailure);
            }

            // Determine overall status
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
            // Cleanup
            await this.cleanupWorkspace(workspaceDir);
        }
    }

    // Map a type string from problem metadata to Java type declarations
    private mapTypeToJava(typeStr: string): string {
        const t = typeStr.toLowerCase().trim();
        if (t === 'integer' || t === 'int') return 'int';
        if (t === 'integer[]' || t === 'int[]') return 'int[]';
        if (t === 'integer[][]' || t === 'int[][]') return 'int[][]';
        if (t === 'string') return 'String';
        if (t === 'string[]') return 'String[]';
        if (t === 'string[][]') return 'String[][]';
        if (t === 'boolean' || t === 'bool') return 'boolean';
        if (t === 'boolean[]' || t === 'bool[]') return 'boolean[]';
        if (t === 'double' || t === 'float') return 'double';
        if (t === 'double[]' || t === 'float[]') return 'double[]';
        if (t === 'long') return 'long';
        if (t === 'long[]') return 'long[]';
        if (t === 'char') return 'char';
        if (t === 'char[]') return 'char[]';
        if (t === 'char[][]') return 'char[][]';
        if (t === 'list<integer>' || t === 'list<int>') return 'List<Integer>';
        if (t === 'list<string>') return 'List<String>';
        if (t === 'list<list<integer>>' || t === 'list<list<int>>') return 'List<List<Integer>>';
        if (t === 'list<list<string>>') return 'List<List<String>>';
        if (t === 'list<boolean>' || t === 'list<bool>') return 'List<Boolean>';
        // Default: return as-is
        return typeStr;
    }

    // Generate Java code to parse a JSON value into the appropriate Java type
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

    // Generate Java code to serialize the result to JSON
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

    private getRunnerTemplate(metadata?: ProblemMetadata): string {
        // Fallback for legacy problems without metadata
        const functionName = metadata?.functionName || 'sortArray';
        const params = metadata?.params || [{ name: 'nums', type: 'int[]' }];
        const returnType = this.mapTypeToJava(metadata?.returnType || 'int[]');

        // Build parsing lines
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
            
            // Parse JSON input using simple parser
            java.util.Map<String, Object> data = parseJson(inputJson);
            
            // Extract parameters
${parseLines}
            
            Solution solution = new Solution();
            ${returnType} result = solution.${functionName}(${argsList});
            
            // Output separator before JSON result (to separate from debug output)
            System.out.println("===RESULT_JSON_START===");
            
            // Output as JSON
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
            // Skip whitespace
            while (i < json.length() && Character.isWhitespace(json.charAt(i))) i++;
            
            // Parse key
            if (json.charAt(i) != '"') break;
            i++; // skip opening quote
            int keyStart = i;
            while (i < json.length() && json.charAt(i) != '"') i++;
            String key = json.substring(keyStart, i);
            i++; // skip closing quote
            
            // Skip colon
            while (i < json.length() && Character.isWhitespace(json.charAt(i))) i++;
            i++; // skip colon
            while (i < json.length() && Character.isWhitespace(json.charAt(i))) i++;
            
            // Parse value
            Object[] valueAndEnd = parseJsonValue(json, i);
            map.put(key, valueAndEnd[0]);
            i = (Integer) valueAndEnd[1];
            
            // Skip comma
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
        List<Integer> result = new ArrayList<>();
        for (Object o : list) result.add(((Number) o).intValue());
        return result;
    }
    
    static List<String> toStringList(java.util.List<?> list) {
        List<String> result = new ArrayList<>();
        for (Object o : list) result.add((String) o);
        return result;
    }
    
    static List<Boolean> toBooleanList(java.util.List<?> list) {
        List<Boolean> result = new ArrayList<>();
        for (Object o : list) result.add((Boolean) o);
        return result;
    }
    
    static List<List<Integer>> toIntegerListList(java.util.List<?> list) {
        List<List<Integer>> result = new ArrayList<>();
        for (Object o : list) result.add(toIntegerList((java.util.List<?>) o));
        return result;
    }
    
    static List<List<String>> toStringListList(java.util.List<?> list) {
        List<List<String>> result = new ArrayList<>();
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
