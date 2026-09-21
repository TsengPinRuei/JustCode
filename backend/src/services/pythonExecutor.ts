import { promises as fs } from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { CompilationError, ProblemMetadata, Testcase } from '../types';
import { COMPILE_TIMEOUT_MS, EXECUTION_TIMEOUT_MS, PYTHON_SANDBOX_IMAGE, RESULT_SEPARATOR } from '../constants';
import { SandboxRunner } from './sandboxRunner';
import { cleanupWorkspace, createWorkspace, executeTestcases, ExecutionSummary, parseTestcaseOutput, TestcaseExecution } from './executionUtils';

export class PythonExecutor {
    private readonly sandboxRunner = new SandboxRunner();

    private async runTestcase(workspaceDir: string, testcase: Testcase, timeoutMs: number): Promise<TestcaseExecution> {
        const startTime = performance.now();
        const result = await this.sandboxRunner.execute({
            command: 'python3',
            args: ['runner.py'],
            cwd: workspaceDir,
            timeoutMs,
            stdin: JSON.stringify(testcase.input),
            image: PYTHON_SANDBOX_IMAGE,
        });
        return parseTestcaseOutput(result, testcase, Math.round(performance.now() - startTime));
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
        const deadline = performance.now() + EXECUTION_TIMEOUT_MS;
        const workspaceDir = await createWorkspace();
        try {
            await fs.writeFile(path.join(workspaceDir, 'solution.py'), userCode);
            await fs.writeFile(path.join(workspaceDir, 'runner.py'), this.getRunnerTemplate(metadata));
            // Validate syntax without executing imports or top-level user code. Runtime
            // exceptions named SyntaxError must remain RE, not editor compilation errors.
            const compiled = await this.sandboxRunner.execute({
                command: 'python3',
                args: ['-c', 'compile(open("solution.py", encoding="utf-8").read(), "solution.py", "exec")'],
                cwd: workspaceDir,
                timeoutMs: Math.min(COMPILE_TIMEOUT_MS, Math.max(1, deadline - performance.now())),
                image: PYTHON_SANDBOX_IMAGE,
            });
            if (compiled.exitCode !== 0) {
                const compilationErrors = this.parsePythonSyntaxErrors(compiled.stderr);
                return {
                    status: compiled.timedOut ? 'TLE' : compilationErrors.length ? 'CE' : 'RE',
                    message: compiled.timedOut ? 'Compilation time limit exceeded' : compiled.stderr.slice(0, 4096),
                    testcaseResults: [], totalTestcases: testcases.length, passedTestcases: 0,
                    compilationErrors,
                };
            }
            return await executeTestcases(testcases, showHiddenInputs, visibleTestcaseCount, deadline,
                (testcase, timeoutMs) => this.runTestcase(workspaceDir, testcase, timeoutMs));
        } finally {
            await cleanupWorkspace(workspaceDir);
        }
    }

    private getRunnerTemplate(metadata?: ProblemMetadata): string {
        const functionName = metadata?.functionName || 'sortArray';
        const params = metadata?.params || [{ name: 'nums', type: 'int[]' }];
        // JSON literals remain data, so parameter names cannot collide with harness locals.
        const names = JSON.stringify(JSON.stringify(params.map(param => param.name)));
        return `import json
import sys
from solution import Solution

def main():
    try:
        data = json.load(sys.stdin)
        names = json.loads(${names})
        result = getattr(Solution(), ${JSON.stringify(functionName)})(*[data[name] for name in names])
        output = json.dumps({'result': result}, allow_nan=False)
        print(${JSON.stringify(RESULT_SEPARATOR)})
        print(output)
    except Exception as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
    }
}
