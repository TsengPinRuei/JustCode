import { parseJson } from '../shared/json';
import { FloatingPointRangeError, normalizeFloatingValue } from './numericContract';
import { promises as fs } from 'fs';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { StringDecoder } from 'string_decoder';
import { ExecutionResult, Testcase, TestcaseResult } from '../types';
import { MAX_OUTPUT_LENGTH, RESULT_SEPARATOR, RESULT_END_SEPARATOR, TESTCASE_TIMEOUT_MS } from '../constants';
import { deferWorkspaceCleanup, hasPendingContainer, SandboxCommandResult } from './sandboxRunner';

export type ExecutionSummary = ExecutionResult & { totalTestcases: number; passedTestcases: number };
export type TestcaseExecution = { result: TestcaseResult; debugOutput: string; infrastructureError?: string };

export async function createWorkspace(): Promise<string> {
    const root = path.join(process.cwd(), 'temp');
    await fs.mkdir(root, { recursive: true });
    return fs.mkdtemp(path.join(root, 'judge-'));
}

export async function cleanupWorkspace(workspaceDir: string): Promise<void> {
    if (hasPendingContainer(workspaceDir)) { deferWorkspaceCleanup(workspaceDir); return; }
    try {
        await fs.rm(workspaceDir, { recursive: true, force: true });
    } catch (error) {
        console.error('Failed to cleanup workspace:', error);
    }
}

function jsonValuesEqual(expected: unknown, actual: unknown): boolean {
    // JSON numbers have no distinct signed-zero value for judge comparisons.
    if (expected === actual) return true;
    if (typeof expected === 'bigint' && typeof actual === 'number' && Number.isSafeInteger(actual)) return expected === BigInt(actual);
    if (typeof actual === 'bigint' && typeof expected === 'number' && Number.isSafeInteger(expected)) return actual === BigInt(expected);
    if (!expected || !actual || typeof expected !== 'object' || typeof actual !== 'object') return false;
    if (Array.isArray(expected)) {
        return Array.isArray(actual) && expected.length === actual.length &&
            expected.every((value, index) => jsonValuesEqual(value, actual[index]));
    }
    if (Array.isArray(actual)) return false;
    const expectedObject = expected as Record<string, unknown>;
    const actualObject = actual as Record<string, unknown>;
    const keys = Object.keys(expectedObject);
    return keys.length === Object.keys(actualObject).length && keys.every(key =>
        Object.prototype.hasOwnProperty.call(actualObject, key) && jsonValuesEqual(expectedObject[key], actualObject[key]));
}

export function parseTestcaseOutput(
    processResult: SandboxCommandResult,
    testcase: Testcase,
    executionTime: number,
    returnType?: string
): TestcaseExecution {
    // Only the bounded payload belongs to the result. Logs before and after it
    // remain debug output, including shutdown hooks and Python atexit handlers.
    // This framing separates output, not hostile code running in the same process.
    const frames = new RegExp(`${RESULT_SEPARATOR}\\r?\\n([^\\r\\n]*)\\r?\\n${RESULT_END_SEPARATOR}(?:\\r?\\n|$)`, 'g');
    let frame: RegExpExecArray | null = null;
    for (const candidate of processResult.stdout.matchAll(frames)) frame = candidate;
    const debugOutput = (frame ? processResult.stdout.slice(0, frame.index) +
        processResult.stdout.slice(frame.index + frame[0].length) : processResult.stdout).trim();
    const result: TestcaseResult = {
        index: 0,
        status: 'Error',
        input: testcase.input,
        expected: testcase.output,
        executionTime,
    };
    if (processResult.infrastructureError) {
        result.errorMessage = processResult.infrastructureError;
    } else if (processResult.timedOut) {
        result.status = 'Timeout';
    } else if (processResult.exitCode !== 0 || processResult.outputExceeded) {
        result.errorMessage = processResult.stderr.slice(0, 4096) || 'Runtime error';
    } else {
        try {
            if (!frame) throw new Error('Missing complete result frame');
            const parsed: unknown = parseJson(frame[1]);
            if (!parsed || typeof parsed !== 'object' || !Object.prototype.hasOwnProperty.call(parsed, 'result')) {
                throw new Error('Missing result value');
            }
            const actual = (parsed as { result: unknown }).result;
            result.actual = returnType ? normalizeFloatingValue(actual, returnType) : actual;
            result.status = jsonValuesEqual(testcase.output, result.actual) ? 'Passed' : 'Failed';
        } catch (error) {
            result.errorMessage = error instanceof FloatingPointRangeError ? `Invalid runner result: ${error.message}` : 'Failed to parse runner output';
        }
    }
    return { result, debugOutput, infrastructureError: processResult.infrastructureError };
}

export async function executeTestcases(
    testcases: Testcase[],
    showHiddenInputs: boolean,
    visibleTestcaseCount: number,
    deadline: number,
    run: (testcase: Testcase, timeoutMs: number) => Promise<TestcaseExecution>
): Promise<ExecutionSummary> {
    if (testcases.length === 0) {
        return { status: 'RE', message: 'No testcases available', testcaseResults: [], totalTestcases: 0, passedTestcases: 0 };
    }
    // Visible testcases must precede hidden testcases; this count marks their boundary.
    const hiddenStart = Math.max(0, Math.min(visibleTestcaseCount, testcases.length));
    const results: TestcaseResult[] = [];
    const debugOutputs: string[] = [];
    let debugBytes = 0;
    let passed = 0;
    let firstFailure: TestcaseResult | undefined;
    let includedHiddenFailure = false;
    let deadlineExceeded = false;
    let infrastructureFailure: string | undefined;

    for (let i = 0; i < testcases.length; i++) {
        const remaining = deadline - performance.now();
        const { result, debugOutput, infrastructureError } = remaining <= 0 ? {
            result: { index: 0, status: 'Timeout' as const, executionTime: 0 },
            debugOutput: '',
        } : await run(testcases[i], Math.max(1, Math.min(TESTCASE_TIMEOUT_MS, remaining)));
        result.index = i + 1;
        const hidden = !showHiddenInputs && i >= hiddenStart;
        if (!hidden && debugOutput && debugBytes < MAX_OUTPUT_LENGTH) {
            const text = Buffer.from(`${debugOutputs.length ? '\n\n' : ''}[Testcase ${i + 1}]\n${debugOutput}`);
            const kept = text.subarray(0, MAX_OUTPUT_LENGTH - debugBytes);
            // Discard an incomplete final code point instead of inserting replacement bytes.
            debugOutputs.push(new StringDecoder('utf8').write(kept));
            debugBytes += kept.length;
        }
        // Hidden stdout and exception messages can reveal the input just as directly
        // as input/expected/actual fields, so only expose status and timing.
        const visibleResult = hidden ? {
            index: result.index,
            status: result.status,
            executionTime: result.executionTime,
        } : result;
        // Keep counting passes after failures until the submission deadline.
        // Return results for executed visible cases, but only the first hidden failure.
        if (result.status === 'Passed') passed++;
        else if (!firstFailure) firstFailure = visibleResult;
        if (!hidden) results.push(visibleResult);
        else if (result.status !== 'Passed' && !includedHiddenFailure) {
            results.push(visibleResult);
            includedHiddenFailure = true;
        }
        if (infrastructureError) { infrastructureFailure = infrastructureError; break; }
        if (remaining <= 0 || performance.now() >= deadline) {
            deadlineExceeded = true;
            break;
        }
    }

    let status: ExecutionSummary['status'] = 'AC';
    let message = 'Accepted';
    // The submission deadline takes precedence over earlier testcase failures.
    // Otherwise, report the first failing testcase in execution order.
    if (infrastructureFailure) {
        status = 'RE';
        message = infrastructureFailure;
    } else if (deadlineExceeded) {
        status = 'TLE';
        message = 'Submission time limit exceeded';
    } else if (firstFailure) {
        if (firstFailure.status === 'Timeout') {
            status = 'TLE';
            message = `Time Limit Exceeded on testcase ${firstFailure.index}`;
        } else if (firstFailure.status === 'Error') {
            status = 'RE';
            message = `Runtime Error on testcase ${firstFailure.index}` +
                (firstFailure.errorMessage ? `: ${firstFailure.errorMessage}` : '');
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
        debugOutput: debugOutputs.length ? debugOutputs.join('') : undefined,
    };
}
