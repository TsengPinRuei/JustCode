import { exec } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Testcase, TestcaseResult, CompilationError } from '../types';
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

            // Compare arrays
            const isCorrect = this.compareArrays(testcase.output, actual);

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

    private compareArrays(expected: number[], actual: number[]): boolean {
        if (!actual || expected.length !== actual.length) {
            return false;
        }
        for (let i = 0; i < expected.length; i++) {
            if (expected[i] !== actual[i]) {
                return false;
            }
        }
        return true;
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
        showHiddenInputs: boolean = true
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
            const runnerCode = this.getRunnerTemplate();
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

    private getRunnerTemplate(): string {
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
            
            // Simple JSON parsing for {"nums":[1,2,3]}
            int[] nums = parseNumsArray(inputJson);
            
            Solution solution = new Solution();
            int[] result = solution.sortArray(nums);
            
            // Output separator before JSON result (to separate from debug output)
            System.out.println("===RESULT_JSON_START===");
            
            // Output as JSON
            System.out.print("{\\"result\\":");
            System.out.print(arrayToJson(result));
            System.out.println("}");
            
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
    
    static int[] parseNumsArray(String json) {
        // Extract array from {"nums":[1,2,3]}
        int start = json.indexOf("[");
        int end = json.indexOf("]");
        String arrayStr = json.substring(start + 1, end);
        
        if (arrayStr.trim().isEmpty()) {
            return new int[0];
        }
        
        String[] parts = arrayStr.split(",");
        int[] result = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            result[i] = Integer.parseInt(parts[i].trim());
        }
        return result;
    }
    
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
}`;
    }
}
