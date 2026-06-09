/**
 * Python Executor — Runs Python3 code in an isolated temp workspace.
 * Generates a runner.py harness that handles JSON I/O and result comparison.
 * Syntax errors are detected from the first interpreted run and surfaced as CE.
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Testcase, TestcaseResult, CompilationError, ProblemMetadata } from '../types';
import { RESULT_SEPARATOR, TESTCASE_TIMEOUT_MS, PYTHON_SANDBOX_IMAGE } from '../constants';
import { SandboxRunner } from './sandboxRunner';

export class PythonExecutor {
    private readonly sandboxRunner = new SandboxRunner();

    /** Create a per-run workspace so user files never collide across executions. */
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

    /** Run one testcase through runner.py and separate user logs from the JSON answer. */
    private async runTestcase(
        workspaceDir: string,
        testcase: Testcase
    ): Promise<{ result: TestcaseResult; debugOutput: string }> {
        const startTime = Date.now();
        const inputJson = JSON.stringify(testcase.input);

        const result = await this.sandboxRunner.execute({
            command: 'python3',
            args: ['runner.py'],
            cwd: workspaceDir,
            timeoutMs: TESTCASE_TIMEOUT_MS,
            stdin: inputJson,
            image: PYTHON_SANDBOX_IMAGE,
            writableWorkspace: false,
        });
        const executionTime = Date.now() - startTime;

        // User print output is allowed before the separator; only the suffix is parsed as JSON.
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

    private compareOutputs(expected: unknown, actual: unknown): boolean {
        return JSON.stringify(expected) === JSON.stringify(actual);
    }

    /** Convert Python traceback snippets into editor markers when possible. */
    private parsePythonSyntaxErrors(stderr: string): CompilationError[] {
        const errors: CompilationError[] = [];
        // Python error format: '  File "solution.py", line 3',
        // followed by a message like 'SyntaxError: invalid syntax'.
        const fileLineRegex = /File "(.+?)", line (\d+)/g;
        const errorMsgRegex = /(SyntaxError|IndentationError|NameError|TypeError):\s*(.+)/;

        let match;
        while ((match = fileLineRegex.exec(stderr)) !== null) {
            const [, file, lineStr] = match;
            const line = parseInt(lineStr, 10);

            // Tracebacks can contain many frames; use the first matching diagnostic message.
            const errorMatch = stderr.match(errorMsgRegex);
            const message = errorMatch ? `${errorMatch[1]}: ${errorMatch[2]}` : 'Syntax error';

            errors.push({
                file: path.basename(file),
                line,
                column: 1,  // Python tracebacks do not always expose a stable column.
                message: message.trim(),
                severity: 'error',
            });
        }

        return errors;
    }

    /** Main entry: write user code, run all testcases, and aggregate results */
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
            // solution.py is the only user-controlled file imported by the generated runner.
            await fs.writeFile(path.join(workspaceDir, 'solution.py'), userCode);

            // runner.py adapts metadata-defined params to the user's LeetCode-style method.
            const runnerCode = this.getRunnerTemplate(metadata);
            await fs.writeFile(path.join(workspaceDir, 'runner.py'), runnerCode);

            // Python has no compile phase here; syntax errors appear when runner.py imports solution.py.

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

                // Reclassify import-time syntax errors as CE so the editor can show markers.
                if (i === 0 && result.status === 'Error' && result.errorMessage) {
                    // Python reports syntax/indentation errors through the traceback on stderr.
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
            // Always remove generated source, caches, and testcase input files.
            await this.cleanupWorkspace(workspaceDir);
        }
    }

    /** Generate the runner.py harness based on problem metadata */
    private getRunnerTemplate(metadata?: ProblemMetadata): string {
        if (!metadata?.functionName || !metadata?.params) {
            console.warn('Missing problem metadata (functionName/params); using hardcoded defaults');
        }
        const functionName = metadata?.functionName || 'sortArray';
        const params = metadata?.params || [{ name: 'nums', type: 'int[]' }];

        // These lines are injected into runner.py and assume testcase input is a JSON object.
        const paramLines = params.map(p => `        ${p.name} = data['${p.name}']`).join('\n');
        const argsList = params.map(p => p.name).join(', ');

        return `import json
import sys
from solution import Solution

def main():
    try:
        # Read the JSON testcase object written by the TypeScript executor.
        input_json = sys.stdin.read().strip()
        data = json.loads(input_json)
        
        # Convert metadata-defined fields into method arguments.
${paramLines}
        
        # Call the user's LeetCode-style solution method.
        solution = Solution()
        result = solution.${functionName}(${argsList})
        
        # Keep user debug output before this marker so the executor can split it safely.
        print("===RESULT_JSON_START===")
        
        # Emit one JSON object so the executor can compare the result structurally.
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
