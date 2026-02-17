import { exec } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Testcase, TestcaseResult, CompilationError, ProblemMetadata } from '../types';
import { RESULT_SEPARATOR, TESTCASE_TIMEOUT_MS, MAX_OUTPUT_LENGTH } from '../constants';



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
    ): Promise<{ result: TestcaseResult; debugOutput: string }> {
        const startTime = Date.now();
        const inputJson = JSON.stringify(testcase.input);

        // Write input to temp file
        const inputFile = path.join(workspaceDir, 'input.txt');
        await fs.writeFile(inputFile, inputJson);

        const runCommand = `python3 runner.py < input.txt`;
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

    private parsePythonSyntaxErrors(stderr: string): CompilationError[] {
        const errors: CompilationError[] = [];
        // Python error format: '  File "solution.py", line 3'
        // Followed by error message like: 'SyntaxError: invalid syntax'
        const fileLineRegex = /File "(.+?)", line (\d+)/g;
        const errorMsgRegex = /(SyntaxError|IndentationError|NameError|TypeError):\s*(.+)/;

        let match;
        while ((match = fileLineRegex.exec(stderr)) !== null) {
            const [, file, lineStr] = match;
            const line = parseInt(lineStr, 10);

            // Try to find the error message
            const errorMatch = stderr.match(errorMsgRegex);
            const message = errorMatch ? `${errorMatch[1]}: ${errorMatch[2]}` : 'Syntax error';

            errors.push({
                file: path.basename(file),
                line,
                column: 1,  // Python doesn't always provide column info
                message: message.trim(),
                severity: 'error',
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
            await fs.writeFile(path.join(workspaceDir, 'solution.py'), userCode);

            // Write Runner template
            const runnerCode = this.getRunnerTemplate(metadata);
            await fs.writeFile(path.join(workspaceDir, 'runner.py'), runnerCode);

            // No compilation step for Python (interpreted language)

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

                // Check for syntax errors on first run (Python is interpreted)
                if (i === 0 && result.status === 'Error' && result.errorMessage) {
                    // Check if this is a syntax error
                    if (result.errorMessage.includes('SyntaxError') ||
                        result.errorMessage.includes('IndentationError') ||
                        result.errorMessage.includes('File "solution.py"')) {
                        const compilationErrors = this.parsePythonSyntaxErrors(result.errorMessage);
                        return {
                            status: 'CE',
                            message: 'Compilation Error: ' + result.errorMessage.split('\n')[0],
                            testcaseResults: [],
                            totalTestcases: testcases.length,
                            passedTestcases: 0,
                            compilationErrors,
                        };
                    }
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

    private getRunnerTemplate(metadata?: ProblemMetadata): string {
        const functionName = metadata?.functionName || 'sortArray';
        const params = metadata?.params || [{ name: 'nums', type: 'int[]' }];

        // Build parameter extraction lines
        const paramLines = params.map(p => `    ${p.name} = data['${p.name}']`).join('\n');
        const argsList = params.map(p => p.name).join(', ');

        return `import json
import sys
from solution import Solution

def main():
    try:
        # Read input from stdin
        input_json = sys.stdin.read().strip()
        data = json.loads(input_json)
        
        # Extract parameters
${paramLines}
        
        # Call user's solution
        solution = Solution()
        result = solution.${functionName}(${argsList})
        
        # Print separator before JSON result (to separate from debug output)
        print("===RESULT_JSON_START===")
        
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
