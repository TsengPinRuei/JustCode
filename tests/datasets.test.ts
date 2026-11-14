import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('every bundled testcase satisfies its declared domain and independent oracle', async () => {
    const counts: Record<string, number[]> = {};
    for (const id of ['add-two-integers', 'sort-array']) {
        const metadata = JSON.parse(await readFile(new URL(`../problems/${id}/problem.json`, import.meta.url), 'utf8'));
        counts[id] = [];
        for (const kind of ['visible', 'hidden']) {
            const cases = JSON.parse(await readFile(new URL(`../problems/${id}/testcases_${kind}.json`, import.meta.url), 'utf8'));
            counts[id].push(cases.length);
            for (const [index, testcase] of cases.entries()) {
                const context = `${id} ${kind} case ${index + 1}`;
                assert.deepEqual(Object.keys(testcase.input).sort(), metadata.params.map((p: { name: string }) => p.name).sort(), context);
                if (id === 'sort-array') {
                    assert(metadata.constraints.includes('1 <= nums.length <= 5 * 10^4'));
                    assert(metadata.constraints.includes('-5 * 10^4 <= nums[i] <= 5 * 10^4'));
                    const nums: number[] = testcase.input.nums;
                    assert(Array.isArray(nums) && nums.length >= 1 && nums.length <= 50000, context);
                    assert(nums.every(value => Number.isInteger(value) && value >= -50000 && value <= 50000), context);
                    assert.deepEqual(testcase.output, [...nums].sort((a, b) => a - b), context);
                } else {
                    const { num1, num2 } = testcase.input;
                    assert([num1, num2].every(value => Number.isInteger(value) && value >= -100 && value <= 100), context);
                    assert.equal(testcase.output, num1 + num2, context);
                }
            }
        }
    }
    assert.deepEqual(counts, { 'add-two-integers': [2, 50], 'sort-array': [3, 69] });
    for (const language of ['README.md', 'READMEzhTW.md']) {
        const readme = await readFile(new URL(`../${language}`, import.meta.url), 'utf8');
        for (const [id, [visible, hidden]] of Object.entries(counts)) {
            const row = readme.split('\n').find(line => line.includes(`problems/${id}/problem.json`));
            assert(row?.includes(`| ${visible} / ${hidden} |`), `${language}: ${id} count`);
        }
    }
});
