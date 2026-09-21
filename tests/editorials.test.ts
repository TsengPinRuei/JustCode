import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import type { ProblemMetadata, Testcase } from '../backend/src/types';

test('all complete sorting editorial solutions handle duplicates and boundary values', { timeout: 90000 }, async t => {
    process.env.JUSTCODE_SANDBOX_MODE = 'local';
    const { JavaExecutor } = await import('../backend/src/services/javaExecutor');
    const { PythonExecutor } = await import('../backend/src/services/pythonExecutor');
    const metadata: ProblemMetadata = JSON.parse(await readFile(new URL('../problems/sort-array/problem.json', import.meta.url), 'utf8'));
    const editorial = await readFile(new URL('../problems/sort-array/editorial.md', import.meta.url), 'utf8');
    const solutions = [...editorial.matchAll(/\x60\x60\x60(java|python)\n([\s\S]*?)\x60\x60\x60/g)]
        .filter(match => match[2].includes('class Solution') && match[2].includes('sortArray'));
    assert.equal(solutions.length, 10);
    const arrays = [
        Array.from({ length: 50000 }, () => 7),
        Array.from({ length: 1500 }, (_, i) => i - 750),
        Array.from({ length: 1500 }, (_, i) => 750 - i),
        [-50000, 50000, 0, -1, 1, -50000, 50000, 7, 7],
    ];
    const testcases: Testcase[] = arrays.map(nums => ({ input: { nums }, output: [...nums].sort((a, b) => a - b) }));
    for (const [index, solution] of solutions.entries()) {
        await t.test(`${solution[1]} solution ${Math.floor(index / 2) + 1}`, async () => {
            const executor = solution[1] === 'java' ? new JavaExecutor() : new PythonExecutor();
            const result = await executor.executeCode(solution[2], testcases, true, metadata, testcases.length);
            assert.equal(result.status, 'AC', JSON.stringify({ message: result.message, errors: result.compilationErrors,
                cases: result.testcaseResults.map(({ status, errorMessage }) => ({ status, errorMessage })) }));
            assert.equal(result.passedTestcases, testcases.length);
        });
    }
});
