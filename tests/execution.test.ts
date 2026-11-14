import { parseJson, stringifyJson } from '../backend/src/shared/json';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { JavaExecutor } from '../backend/src/services/javaExecutor';
import { PythonExecutor } from '../backend/src/services/pythonExecutor';
import { executeTestcases, parseTestcaseOutput } from '../backend/src/services/executionUtils';
import { ProblemMetadata } from '../backend/src/types';
import { RESULT_SEPARATOR, RESULT_END_SEPARATOR } from '../backend/src/constants';

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
    const result = parseTestcaseOutput(output(`${RESULT_SEPARATOR}\nlogging\n${RESULT_SEPARATOR}\n${JSON.stringify({ result: actual })}\n${RESULT_END_SEPARATOR}\n`),
        { input: {}, output: expected }, 1500);
    assert.equal(result.result.status, 'Passed');
    assert.match(result.debugOutput, /logging/);
    assert.equal(parseTestcaseOutput(output(`${RESULT_SEPARATOR}\n{}\n${RESULT_END_SEPARATOR}\n`), { input: {}, output: null }, 0).result.status, 'Error');
    assert.equal(parseTestcaseOutput(output('{"result":null}'), { input: {}, output: null }, 0).result.status, 'Error');
});

test('result parsing accepts Windows line endings and preserves numeric zero equality', () => {
    const parsed = parseTestcaseOutput(output(`${RESULT_SEPARATOR}\r\n{"result":{"value":[0]}}\r\n${RESULT_END_SEPARATOR}\r\n`),
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


test('bounded result frames preserve trailing Unicode logs and reject broken frames', () => {
    const result = parseTestcaseOutput(output(`before\n${RESULT_SEPARATOR}\n{"result":"中文😀"}\n${RESULT_END_SEPARATOR}\nafter 中文😀\n${RESULT_SEPARATOR}\nlogging`),
        { input: {}, output: '中文😀' }, 1);
    assert.equal(result.result.status, 'Passed');
    assert.match(result.debugOutput, /after 中文😀/);
    for (const broken of [`${RESULT_SEPARATOR}\n{"result":7}`, `${RESULT_SEPARATOR}\n{broken}\n${RESULT_END_SEPARATOR}\n`]) {
        assert.equal(parseTestcaseOutput(output(broken), { input: {}, output: 7 }, 0).result.status, 'Error');
    }
});

test('both runners retain normal logging after the result frame', { skip: !hasJava || !hasPython }, async () => {
    const cases = [{ input: { data: 7 }, output: 7 }];
    const python = await new PythonExecutor().executeCode('import atexit\natexit.register(lambda: print("cleanup complete 中文😀"))\nclass Solution:\n    def echo(self, data): return data', cases, true, metadata('int'));
    const java = await new JavaExecutor().executeCode('class Solution { public int echo(int data) { Runtime.getRuntime().addShutdownHook(new Thread(() -> System.out.println("cleanup complete 中文😀"))); return data; } }', cases, true, metadata('int'));
    for (const result of [python, java]) {
        assert.equal(result.status, 'AC', stringifyJson(result));
        assert.match(result.debugOutput || '', /cleanup complete 中文😀/);
    }
});

test('exact integer JSON round trips include exponent forms and nested values', () => {
    const value = parseJson('{"values":[9007199254740991,9007199254740992,9007199254740993,-9007199254740993,-9223372036854775808,9223372036854775807,9.007199254740993e15,9007199254740993.0],"text":"9007199254740993"}');
    assert.deepEqual(parseJson(stringifyJson(value)), value);
    const values = (value as { values: unknown[] }).values;
    assert.equal(values[0], Number.MAX_SAFE_INTEGER);
    assert.equal(values[2], 9007199254740993n);
    assert.equal(values[6], values[2]);
    assert.equal(values[7], values[2]);
    const wrong = parseTestcaseOutput(output(`${RESULT_SEPARATOR}\n{"result":9007199254740993}\n${RESULT_END_SEPARATOR}\n`), { input: {}, output: 9007199254740992n }, 0);
    assert.equal(wrong.result.status, 'Failed');
    assert.equal(wrong.result.actual, 9007199254740993n);
});

test('Java long and Python integer judges distinguish adjacent large answers', { skip: !hasJava || !hasPython }, async () => {
    const cases = [{ input: { data: 0 }, output: 9007199254740992n }];
    const java = await new JavaExecutor().executeCode('class Solution { public long echo(long data) { return 9007199254740993L; } }', cases, true, metadata('long'));
    const python = await new PythonExecutor().executeCode('class Solution:\n    def echo(self, data): return 9007199254740993', cases, true, metadata('int'));
    for (const result of [java, python]) {
        assert.equal(result.status, 'WA', stringifyJson(result));
        assert.equal(result.testcaseResults[0].actual, 9007199254740993n);
    }
    const bounds = parseJson('[-9223372036854775808,9223372036854775807,-9007199254740993,-9007199254740992,-9007199254740991,9007199254740991,9007199254740992,9007199254740993]') as unknown[];
    const exact = await new JavaExecutor().executeCode('class Solution { public long[] echo(long[] data) { return data; } }', [{ input: { data: bounds }, output: bounds }], true, metadata('long[]'));
    assert.equal(exact.status, 'AC', stringifyJson(exact));
    const nested = [[10n ** 80n, -(10n ** 80n)], [9007199254740993n]];
    const pyExact = await new PythonExecutor().executeCode('class Solution:\n    def echo(self, data): return data', [{ input: { data: nested }, output: nested }], true, metadata('int[][]'));
    assert.equal(pyExact.status, 'AC', stringifyJson(pyExact));
});

test('Java doubles accept large integral lexemes and float aliases', { skip: !hasJava }, async () => {
    const values = parseJson('[10000000000000000000,-10000000000000000000,1e20,1e21,1.5]') as unknown[];
    for (const type of ['double[]', 'float[]']) {
        const result = await new JavaExecutor().executeCode('class Solution { public double[] echo(double[] data) { return data; } }', [{ input: { data: values }, output: values }], true, metadata(type));
        assert.equal(result.status, 'AC', stringifyJson(result));
    }
    const mismatch = await new JavaExecutor().executeCode('class Solution { public float echo(float data) { return data; } }', [{ input: { data: 1.5 }, output: 1.5 }], true, metadata('float'));
    assert.equal(mismatch.status, 'CE');
    assert.match(mismatch.message || '', /float\/float\[\] means Java double/);
});

test('invalid integral values and primitive-array nulls fail before Solution execution', { skip: !hasJava }, async () => {
    for (const [type, data] of [['long', 9223372036854775808n], ['int', 2147483648], ['int', parseJson('1.00000000000000001')], ['int[]', [1, null]]]) {
        const result = await new JavaExecutor().executeCode('invalid source must never compile', [{ input: { data }, output: null }], true, metadata(type as string));
        assert.equal(result.status, 'RE', stringifyJson(result));
        assert.match(result.message || '', /Invalid testcase data/);
        assert.equal(result.compilationErrors, undefined);
    }
});

test('Java boxed lists preserve nullable values consistently', { skip: !hasJava }, async () => {
    for (const [type, javaType, data] of [
        ['list<integer>', 'List<Integer>', [1, null, -2147483648, 2147483647]],
        ['list<list<integer>>', 'List<List<Integer>>', [[1, null], null]],
        ['list<boolean>', 'List<Boolean>', [true, null, false]],
        ['list<string>', 'List<String>', ['text', null]],
    ] as const) {
        const result = await new JavaExecutor().executeCode(`import java.util.*; class Solution { public ${javaType} echo(${javaType} data) { return data; } }`, [{ input: { data }, output: data }], true, metadata(type));
        assert.equal(result.status, 'AC', stringifyJson(result));
    }
});


test('Python integer round trips are not limited to 4300 decimal digits', { skip: !hasPython }, async () => {
    const integer = BigInt('1' + '0'.repeat(5000));
    const result = await new PythonExecutor().executeCode('class Solution:\n    def echo(self, data): return data', [{ input: { data: integer }, output: integer }], true, metadata('int'));
    assert.equal(result.status, 'AC', result.message);
    assert.equal(result.testcaseResults[0].actual, integer);
});

test('unconfirmed container cleanup stops the remaining testcases', async () => {
    let calls = 0;
    const summary = await executeTestcases([{ input: {}, output: 1 }, { input: {}, output: 1 }], false, 0, performance.now() + 1000, async () => {
        calls++;
        return { result: { index: 0, status: 'Error' }, debugOutput: '', infrastructureError: 'Docker cleanup could not be confirmed for justcode-test' };
    });
    assert.equal(calls, 1);
    assert.equal(summary.status, 'RE');
    assert.match(summary.message || '', /justcode-test/);
});


test('floating result conversion rejects overflow before exposing actual values', () => {
    for (const [type, actual] of [
        ['double', 10n ** 400n],
        ['float', -(10n ** 400n)],
        ['double[]', [1, 10n ** 400n]],
        ['float[][]', [[1], [-(10n ** 400n)]]],
    ] as const) {
        const parsed = parseTestcaseOutput(output(`${RESULT_SEPARATOR}\n${stringifyJson({ result: actual })}\n${RESULT_END_SEPARATOR}\n`),
            { input: {}, output: null }, 0, type);
        assert.equal(parsed.result.status, 'Error');
        assert.match(parsed.result.errorMessage || '', /finite double range/);
        assert.equal(Object.prototype.hasOwnProperty.call(parsed.result, 'actual'), false);
        assert.equal(stringifyJson(parsed).includes('"actual":null'), false);
    }
});

test('Python custom-style floating output rejects huge integer returns as runtime errors', { skip: !hasPython }, async () => {
    for (const [type, expression, data] of [['double', '10 ** 400', 0], ['float[]', '[10 ** 400]', []]] as const) {
        const result = await new PythonExecutor().executeCode(`class Solution:\n    def echo(self, data): return ${expression}`,
            [{ input: { data }, output: null }], true, metadata(type));
        assert.equal(result.status, 'RE', stringifyJson(result));
        assert.equal(result.passedTestcases, 0);
        assert.equal(result.testcaseResults[0].status, 'Error');
        assert.match(result.message || '', /finite double range/);
        assert.equal(Object.prototype.hasOwnProperty.call(result.testcaseResults[0], 'actual'), false);
    }
});
