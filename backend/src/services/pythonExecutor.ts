import { exec } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Testcase, TestcaseResult } from '../types';

const TIMEOUT_MS = 1000; // 1 second per testcase
const MAX_OUTPUT_LENGTH = 10000; // Limit output to prevent memory issues

export class PythonExecutor {
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
                            // Runtime error
                            resolve({ stdout, stderr, exitCode: error.code || 1 });
                        }
                    } else {
                        resolve({ stdout, stderr, exitCode: 0 });
                    }
                }
            );
        });
    }

    private async runTestcase(
        workspaceDir: string,
        testcase: Testcase
    ): Promise<TestcaseResult> {
        const startTime = Date.now();
        const inputJson = JSON.stringify(testcase.input);

        // Write input to temp file
        const inputFile = path.join(workspaceDir, 'input.txt');
        await fs.writeFile(inputFile, inputJson);

        const runCommand = `python3 runner.py < input.txt`;
        const result = await this.executeCommand(runCommand, workspaceDir, TIMEOUT_MS);
        const executionTime = Date.now() - startTime;

        // Check for timeout
        if (result.exitCode === -1 || executionTime >= TIMEOUT_MS) {
            return {
                index: 0,
                status: 'Timeout',
                input: testcase.input,
                expected: testcase.output,
                executionTime,
            };
        }

        // Check for runtime error
        if (result.exitCode !== 0) {
            return {
                index: 0,
                status: 'Error',
                input: testcase.input,
                expected: testcase.output,
                errorMessage: result.stderr || 'Runtime error',
                executionTime,
            };
        }

        // Parse output
        try {
            const output = result.stdout.trim();
            const parsed = JSON.parse(output);
            const actual = parsed.result;

            // Compare arrays
            const isCorrect = this.compareArrays(testcase.output, actual);

            return {
                index: 0,
                status: isCorrect ? 'Passed' : 'Failed',
                input: testcase.input,
                expected: testcase.output,
                actual,
                executionTime,
            };
        } catch (error) {
            return {
                index: 0,
                status: 'Error',
                input: testcase.input,
                expected: testcase.output,
                errorMessage: 'Failed to parse output: ' + result.stdout,
                executionTime,
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
    }> {
        const workspaceDir = await this.createTempWorkspace();

        try {
            // Write user solution
            await fs.writeFile(path.join(workspaceDir, 'solution.py'), userCode);

            // Write Runner template
            const runnerCode = this.getRunnerTemplate();
            await fs.writeFile(path.join(workspaceDir, 'runner.py'), runnerCode);

            // No compilation step for Python (interpreted language)

            // Run all testcases
            const results: TestcaseResult[] = [];
            let passed = 0;
            let firstFailure: TestcaseResult | null = null;
            let firstHiddenFailure: TestcaseResult | null = null;

            for (let i = 0; i < testcases.length; i++) {
                const result = await this.runTestcase(workspaceDir, testcases[i]);
                result.index = i + 1;

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
            };
        } finally {
            // Cleanup
            await this.cleanupWorkspace(workspaceDir);
        }
    }

    private getRunnerTemplate(): string {
        return `import json
import sys
from solution import Solution

def main():
    try:
        # Read input from stdin
        input_json = sys.stdin.read().strip()
        data = json.loads(input_json)
        nums = data['nums']
        
        # Call user's solution
        solution = Solution()
        result = solution.sortArray(nums)
        
        # Output result as JSON
        output = {'result': result}
        print(json.dumps(output))
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
    }
}
