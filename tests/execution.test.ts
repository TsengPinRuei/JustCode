import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { JavaExecutor } from '../backend/src/services/javaExecutor';
import { PythonExecutor } from '../backend/src/services/pythonExecutor';
import { executeTestcases, parseTestcaseOutput } from '../backend/src/services/executionUtils';
import { ProblemMetadata } from '../backend/src/types';
import { RESULT_SEPARATOR } from '../backend/src/constants';

function metadata(type: string, name = 'data'): ProblemMetadata {
    return {
        id: 'execution-test', title: 'Test', difficulty: 'Easy', tags: [], description: '', examples: [], constraints: [],
        supportedLanguages: ['java', 'python3'], functionSignatures: { java: '', python3: '' },
        functionName: 'echo', params: [{ name, type }], returnType: type,
    };
}
const hasJava = spawnSync('javac', ['-version']).status === 0;
const hasPython = spawnSync('python3', ['--version']).status === 0;

function output(stdout: string) {
    return { stdout, stderr: '', exitCode: 0, timedOut: false, outputExceeded: false, sandboxMode: 'local' as const };
}

test('result parsing ignores object key order, debug markers, and preparation time', () => {
    const expected = { a: 1, b: [true, null] };
    const actual = { b: [true, null], a: 1 };
    const result = parseTestcaseOutput(output(`${RESULT_SEPARATOR}\nlogging\n${RESULT_SEPARATOR}\n${JSON.stringify({ result: actual })}`),
        { input: {}, output: expected }, 1500);
    assert.equal(result.result.status, 'Passed');
    assert.match(result.debugOutput, /logging/);
    assert.equal(parseTestcaseOutput(output(`${RESULT_SEPARATOR}\n{}`), { input: {}, output: null }, 0).result.status, 'Error');
    assert.equal(parseTestcaseOutput(output('{"result":null}'), { input: {}, output: null }, 0).result.status, 'Error');
});

test('result parsing accepts Windows line endings and preserves numeric zero equality', () => {
    const parsed = parseTestcaseOutput(output(`${RESULT_SEPARATOR}\r\n{"result":{"value":[0]}}\r\n`),
        { input: {}, output: { value: [-0] } }, 0);
    assert.equal(parsed.result.status, 'Passed');
});

test('hidden results suppress input, expected, actual, exceptions and debug output', async () => {
    const summary = await executeTestcases([{ input: { secret: 123 }, output: 123 }], false, 0, performance.now() + 1000,
        async () => ({ result: { index: 0, status: 'Error', input: 123, expected: 123, actual: 123, errorMessage: 'secret 123' }, debugOutput: 'secret 123' }));
    assert.equal(summary.status, 'RE');
    assert.equal(JSON.stringify(summary).includes('123'), false);
    assert.equal(summary.testcaseResults[0].status, 'Error');
});

test('whole-submission deadline stops before starting another process', async () => {
    let calls = 0;
    const summary = await executeTestcases([{ input: {}, output: 0 }], true, 1, performance.now() - 1, async () => {
        calls++;
        throw new Error('must not run');
    });
    assert.equal(calls, 0);
    assert.equal(summary.status, 'TLE');
    assert.equal((await executeTestcases([], true, 0, performance.now() + 1000, async () => { throw Error(); })).status, 'RE');
});

test('Java preserves JSON escapes, Unicode, null strings, and harness-name parameters', { skip: !hasJava }, async () => {
    const strings = ['quote"slash\\\n\r\t\b\f\u0000中文😀', 'brace } {', RESULT_SEPARATOR, '\ud800', null];
    const result = await new JavaExecutor().executeCode('class Solution { public String[] echo(String[] data) { return data; } }',
        [{ input: { data: strings }, output: strings }, { input: { data: null }, output: null }], true, metadata('string[]'));
    assert.equal(result.status, 'AC', JSON.stringify(result));
    assert.equal(result.passedTestcases, 2);
});

test('Java list and character output use the same valid JSON escaping', { skip: !hasJava }, async () => {
    const list = await new JavaExecutor().executeCode('import java.util.*; class Solution { public List<List<String>> echo(List<List<String>> data) { return data; } }',
        [{ input: { data: [['a\nb', null], null] }, output: [['a\nb', null], null] }], true, metadata('list<list<string>>'));
    assert.equal(list.status, 'AC', JSON.stringify(list));
    const chars = await new JavaExecutor().executeCode('class Solution { public char[] echo(char[] data) { return data; } }',
        [{ input: { data: ['"', '\\', '\n'] }, output: ['"', '\\', '\n'] }], true, metadata('char[]'));
    assert.equal(chars.status, 'AC', JSON.stringify(chars));
});

test('Java non-finite outputs and compiler errors produce explicit failures', { skip: !hasJava }, async () => {
    const executor = new JavaExecutor();
    assert.equal((await executor.executeCode('class Solution { public double echo(double data) { return Double.NaN; } }',
        [{ input: { data: 0 }, output: 0 }], true, metadata('double'))).status, 'RE');
    const error = await executor.executeCode('class Solution { syntax error }', [{ input: { data: 1 }, output: 1 }], true, metadata('int'));
    assert.equal(error.status, 'CE');
    assert.ok(error.compilationErrors?.some(value => value.file === 'Solution.java'));
});

test('Python accepts reordered objects, Unicode and marker debug output', { skip: !hasPython }, async () => {
    const result = await new PythonExecutor().executeCode(`class Solution:\n    def echo(self, data):\n        print("${RESULT_SEPARATOR}")\n        return {"b": data["b"], "a": data["a"]}\n`,
        [{ input: { data: { a: '中文😀\n', b: null } }, output: { a: '中文😀\n', b: null } }], true, metadata('string'));
    assert.equal(result.status, 'AC', JSON.stringify(result));
    assert.match(result.debugOutput || '', /RESULT_JSON_START/);
});

test('Python distinguishes syntax errors from runtime errors and enforces timeouts', { skip: !hasPython }, async () => {
    const executor = new PythonExecutor();
    const cases = [{ input: { data: 1 }, output: 1 }];
    const syntax = await executor.executeCode('class Solution:\n    def echo(self, data)\n        return data', cases, true, metadata('int'));
    assert.equal(syntax.status, 'CE', JSON.stringify(syntax));
    assert.deepEqual(syntax.compilationErrors?.map(error => error.file), ['solution.py']);
    const runtime = await executor.executeCode('raise SyntaxError("raised at runtime")', cases, true, metadata('int'));
    assert.equal(runtime.status, 'RE', JSON.stringify(runtime));
    const timeout = await executor.executeCode('class Solution:\n    def echo(self, data):\n        while True: pass', cases, true, metadata('int'));
    assert.equal(timeout.status, 'TLE', JSON.stringify(timeout));
});
