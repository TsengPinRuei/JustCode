import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LeetCodeService } from '../backend/src/services/leetcodeService';

const question = () => ({
    questionId: '1', questionFrontendId: '1', title: 'Echo', titleSlug: 'echo', difficulty: 'Easy',
    topicTags: [{ name: 'Strings', slug: 'strings' }],
    codeSnippets: [{ lang: 'Python3', langSlug: 'python3', code: 'class Solution:\n    def echo(self, text: str) -> str:\n        pass' }],
    exampleTestcaseList: ['"<a>&"'],
    metaData: JSON.stringify({ name: 'echo', params: [{ name: 'text', type: 'string' }], return: { type: 'string' } }),
    content: '<p>Preserve a &lt; b &gt; c and &#x1F600;.</p><p><strong>Example 1:</strong></p><pre><strong>Input:</strong> text = "&lt;a&gt;&amp;"\n<strong>Output:</strong> "&lt;a&gt;&amp;"</pre><p><strong>Constraints:</strong></p><ul><li class="constraint">-100 &lt;= text.length &lt;= 100</li></ul>',
});

test('LeetCode import validates URLs, response data, and testcase alignment', async t => {
    let current: unknown = question();
    let fetchCalls = 0;
    t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
        fetchCalls++;
        assert(options.signal instanceof AbortSignal);
        return new Response(JSON.stringify({ data: { question: current } }), { status: 200 });
    });
    const service = new LeetCodeService();
    await t.test('rejects spoofed or malformed hosts before making a network request', async () => {
        for (const url of ['https://evil-leetcode.com/problems/echo/', 'https://evil.example/leetcode.com/problems/echo/',
            'https://leetcode.com.evil.example/problems/echo/', 'javascript:leetcode.com/problems/echo/',
            'https://user@leetcode.com/problems/echo/', 'https://leetcode.com/problems/echo%20bad/']) {
            await assert.rejects(service.importProblem(url), { code: 'EINVAL' });
        }
        assert.equal(fetchCalls, 0);
    });
    await t.test('keeps comparison operators, escaped tag text, unicode entities, and expected outputs', async () => {
        const result = await service.importProblem('https://leetcode.com/problems/echo/description/?envType=study-plan');
        assert.equal(result.metadata.description, 'Preserve a < b > c and 😀.');
        assert.deepEqual(result.metadata.constraints, ['-100 <= text.length <= 100']);
        assert.equal(result.metadata.examples[0].output, '"<a>&"');
        assert.equal(result.visibleTestcases[0].input.text, '<a>&');
        assert.equal(result.visibleTestcases[0].output, '<a>&');
    });
    await t.test('rejects malformed remote enum fields and design-class metadata', async () => {
        for (const bad of [{ ...question(), difficulty: ['Easy'] }, { ...question(), content: null },
            { ...question(), metaData: JSON.stringify({ methods: [] }) },
            { ...question(), metaData: JSON.stringify({ name: 'echo();', params: [], return: { type: 'string' } }) }]) {
            current = bad;
            await assert.rejects(service.importProblem('https://leetcode.com/problems/echo/'));
        }
    });
    await t.test('does not invent null outputs for missing examples or accept incomplete inputs', async () => {
        current = { ...question(), exampleTestcaseList: ['"first"', '"second"'] };
        await assert.rejects(service.importProblem('https://leetcode.com/problems/echo/'), /match every public example/);
        current = { ...question(), exampleTestcaseList: [''] };
        await assert.rejects(service.importProblem('https://leetcode.com/problems/echo/'), /parameter count/);
        current = {
            ...question(), exampleTestcaseList: ['not-a-number'],
            metaData: JSON.stringify({ name: 'echo', params: [{ name: 'text', type: 'integer' }], return: { type: 'string' } }),
        };
        await assert.rejects(service.importProblem('https://leetcode.com/problems/echo/'), /invalid value/);
    });
});

test('LeetCode import cancels oversized response streams', async t => {
    let cancelled = false;
    t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
        start(controller) { controller.enqueue(new Uint8Array(10 * 1024 * 1024 + 1)); },
        cancel() { cancelled = true; },
    })));
    await assert.rejects(new LeetCodeService().importProblem('https://leetcode.com/problems/echo/'), /exceeds 10 MB/);
    assert.equal(cancelled, true);
});
