import { stringifyJson } from '../shared/json';
import { normalizeTestcases } from './numericContract';
import { promises as fs } from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { CompilationError, ProblemMetadata, Testcase } from '../types';
import { COMPILE_TIMEOUT_MS, EXECUTION_TIMEOUT_MS, PYTHON_SANDBOX_IMAGE, RESULT_SEPARATOR, RESULT_END_SEPARATOR } from '../constants';
import { SandboxRunner } from './sandboxRunner';
import { cleanupWorkspace, createWorkspace, executeTestcases, ExecutionSummary, parseTestcaseOutput, TestcaseExecution } from './executionUtils';

export class PythonExecutor {
    private readonly sandboxRunner = new SandboxRunner();

    private async runTestcase(workspaceDir: string, testcase: Testcase, timeoutMs: number, returnType?: string): Promise<TestcaseExecution> {
        const startTime = performance.now();
        const result = await this.sandboxRunner.execute({
            command: 'python3',
            args: ['runner.py'],
            cwd: workspaceDir,
            timeoutMs,
            stdin: stringifyJson(testcase.input),
            image: PYTHON_SANDBOX_IMAGE,
        });
        return parseTestcaseOutput(result, testcase, Math.round(performance.now() - startTime), returnType);
    }

    private parsePythonSyntaxErrors(stderr: string): CompilationError[] {
        const errors: CompilationError[] = [];
        const message = stderr.match(/(?:SyntaxError|IndentationError|TabError):[^\n]+/)?.[0] || 'Syntax error';
        for (const match of stderr.matchAll(/File "([^"\n]+)", line (\d+)/g)) {
            if (path.basename(match[1]) === 'solution.py') {
                errors.push({ file: 'solution.py', line: Number(match[2]), column: 1, message, severity: 'error' });
            }
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
        try {
            testcases = normalizeTestcases(testcases, metadata, 'python3');
        } catch (error) {
            return { status: 'RE', judgeError: true, message: `Invalid testcase data: ${error instanceof Error ? error.message : String(error)}`,
                testcaseResults: [], totalTestcases: testcases.length, passedTestcases: 0 };
        }
        const deadline = performance.now() + EXECUTION_TIMEOUT_MS;
        const workspaceDir = await createWorkspace();
        try {
            await fs.writeFile(path.join(workspaceDir, 'solution.py'), userCode);
            await fs.writeFile(path.join(workspaceDir, 'runner.py'), this.getRunnerTemplate(metadata));
            // Validate syntax without executing imports or top-level user code. Runtime
            // exceptions named SyntaxError must remain RE, not editor compilation errors.
            const compiled = await this.sandboxRunner.execute({
                command: 'python3',
                args: ['-c', 'import sys; getattr(sys, "set_int_max_str_digits", lambda _: None)(0); compile(open("solution.py", encoding="utf-8").read(), "solution.py", "exec")'],
                cwd: workspaceDir,
                timeoutMs: Math.min(COMPILE_TIMEOUT_MS, Math.max(1, deadline - performance.now())),
                image: PYTHON_SANDBOX_IMAGE,
            });
            if (compiled.exitCode !== 0) {
                const compilationErrors = this.parsePythonSyntaxErrors(compiled.stderr);
                return {
                    status: compiled.infrastructureError ? 'RE' : compiled.timedOut ? 'TLE' : compilationErrors.length ? 'CE' : 'RE',
                    message: compiled.infrastructureError || (compiled.timedOut ? 'Compilation time limit exceeded' : compiled.stderr.slice(0, 4096)),
                    testcaseResults: [], totalTestcases: testcases.length, passedTestcases: 0,
                    compilationErrors,
                    ...(compiled.infrastructureError && { judgeError: true as const }),
                };
            }
            return await executeTestcases(testcases, showHiddenInputs, visibleTestcaseCount, deadline,
                (testcase, timeoutMs) => this.runTestcase(workspaceDir, testcase, timeoutMs, metadata?.returnType));
        } finally {
            await cleanupWorkspace(workspaceDir);
        }
    }

    private getRunnerTemplate(metadata?: ProblemMetadata): string {
        const functionName = metadata?.functionName || 'sortArray';
        const params = metadata?.params || [{ name: 'nums', type: 'int[]' }];
        // Encode the name list as JSON, then encode that JSON as a Python string literal.
        // json.loads restores the names without inserting them as runner variable names.
        const names = JSON.stringify(JSON.stringify(params.map(param => param.name)));
        return `import json
import sys
# The request/output byte and execution-time budgets bound integer conversion.
# Python 3.11+ otherwise adds a separate decimal-string digit limit.
if hasattr(sys, "set_int_max_str_digits"):
    sys.set_int_max_str_digits(0)
from solution import Solution

def main():
    try:
        data = json.load(sys.stdin)
        names = json.loads(${names})
        result = getattr(Solution(), ${JSON.stringify(functionName)})(*[data[name] for name in names])
        output = json.dumps({'result': result}, allow_nan=False)
        print(${JSON.stringify(RESULT_SEPARATOR)})
        print(output)
        print(${JSON.stringify(RESULT_END_SEPARATOR)})
    except Exception as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
    }
}
