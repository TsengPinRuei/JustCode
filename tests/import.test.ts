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

test('import preserves mathematical notation across descriptions, examples, and constraints', async t => {
    const fixture = question();
    fixture.content = '<p>Use <code>10<sup>5</sup></code>, a<sub>i</sub>, and 10<sup>-12</sup>.</p>' +
        '<p><strong>Example 1:</strong></p><pre><strong>Input:</strong> text = "x"\n<strong>Output:</strong> "x"\n' +
        '<strong>Explanation:</strong> a<sub>i</sub> &lt;= 10<sup>12</sup></pre>' +
        '<p><strong>Constraints:</strong></p><ul><li>1 &lt;= n &lt;= 10<sup>5</sup></li>' +
        '<li>a<sub>i</sub> &lt; 10<sup>-12</sup></li><li>10<sup>12</sup> &gt; n</li></ul>';
    fixture.exampleTestcaseList = ['"x"'];
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data: { question: fixture } })));
    const result = await new LeetCodeService().importProblem('https://leetcode.com/problems/echo/');
    assert.equal(result.metadata.description, 'Use `10^5`, a_i, and 10^(-12).');
    assert.equal(result.metadata.examples[0].explanation, 'a_i <= 10^12');
    assert.deepEqual(result.metadata.constraints, ['1 <= n <= 10^5', 'a_i < 10^(-12)', '10^12 > n']);
});

test('import preserves all field names inside quoted values and refuses ambiguous or truncated examples', async t => {
    const literal = 'Input: Output: Explanation: "quoted" & <tag> 😀';
    const encoded = JSON.stringify(literal).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let fixture = { ...question(), exampleTestcaseList: [JSON.stringify(literal)], content:
        `<p>Echo text.</p><p><strong>Example 1:</strong></p><pre><strong>Input:</strong> text = ${encoded}\n` +
        `<strong>Output:</strong> ${encoded}\n<strong>Explanation:</strong> Output: is also literal prose.</pre>` };
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data: { question: fixture } })));
    const service = new LeetCodeService();
    const result = await service.importProblem('https://leetcode.com/problems/echo/');
    assert.equal(result.visibleTestcases[0].input.text, literal);
    assert.equal(result.visibleTestcases[0].output, literal);
    assert.equal(result.metadata.examples[0].output, JSON.stringify(literal));
    assert.equal(result.metadata.examples[0].explanation, 'Output: is also literal prose.');

    fixture = { ...fixture, content: '<p><strong>Example 1:</strong></p><pre>Input: text = "x"\nOutput: "x"</pre>' };
    await assert.rejects(service.importProblem('https://leetcode.com/problems/echo/'), /ambiguous.*labels/);
    fixture = { ...fixture, content: '<p><strong>Example 1:</strong></p><pre><strong>Input:</strong> text = "x"\n<strong>Output:</strong> "broken</pre>' };
    await assert.rejects(service.importProblem('https://leetcode.com/problems/echo/'), /unsupported expected output/);
    fixture = { ...fixture, content: '<p><strong>Example 1:</strong></p><pre><strong>Input:</strong> text = x\n<strong>Output:</strong> unquoted text</pre>' };
    assert.equal((await service.importProblem('https://leetcode.com/problems/echo/')).visibleTestcases[0].output, 'unquoted text');
});

test('import retains images and safe link targets including relative URLs and example diagrams', async t => {
    const fixture = question();
    fixture.content = '<p>See <a href="/problems/rotate-image/">the diagram</a> and <a href="https://example.com/info?q=1&amp;p=2">details</a>.</p>' +
        '<figure><img src="/images/rotate.png" alt="rotation [diagram]"><figcaption>Rotate clockwise.</figcaption></figure>' +
        '<p><a href="javascript:alert(1)">unsafe link</a><img src="data:text/html,hello" alt="unsafe image"></p>' +
        '<p><strong>Example 1:</strong></p><pre><strong>Input:</strong> text = "x"\n<strong>Output:</strong> "x"\n' +
        '<strong>Explanation:</strong> <img src="https://example.com/example.png" alt="example diagram"></pre>';
    fixture.exampleTestcaseList = ['"x"'];
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data: { question: fixture } })));
    const { metadata } = await new LeetCodeService().importProblem('https://leetcode.com/problems/echo/');
    assert.ok(metadata.description.includes('[the diagram](<https://leetcode.com/problems/rotate-image/>)'));
    assert.ok(metadata.description.includes('[details](<https://example.com/info?q=1&p=2>)'));
    assert.ok(metadata.description.includes('![rotation \\[diagram\\]](<https://leetcode.com/images/rotate.png>)'));
    assert.match(metadata.description, /Rotate clockwise/);
    assert.match(metadata.description, /unsafe link \(link omitted: unsupported URL\)/);
    assert.match(metadata.description, /Image unavailable: unsafe image/);
    assert.doesNotMatch(metadata.description, /javascript:|data:text/);
    assert.equal(metadata.examples[0].explanation, '![example diagram](<https://example.com/example.png>)');
});

test('import keeps exact integer tokens in public example inputs and expected outputs', async t => {
    const fixture = { ...question(), exampleTestcaseList: ['9007199254740993'],
        metaData: JSON.stringify({ name: 'echo', params: [{ name: 'text', type: 'long' }], return: { type: 'long' } }),
        content: '<p>Echo.</p><p><strong>Example 1:</strong></p><pre><strong>Input:</strong> text = 9007199254740993\n<strong>Output:</strong> 9007199254740993</pre>' };
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data: { question: fixture } })));
    const result = await new LeetCodeService().importProblem('https://leetcode.com/problems/echo/');
    assert.equal(result.visibleTestcases[0].input.text, 9007199254740993n);
    assert.equal(result.visibleTestcases[0].output, 9007199254740993n);
});
