import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { LeetCodeService } from '../backend/src/services/leetcodeService';
import { addJavaStandardImports, addPythonStandardImports } from '../backend/src/services/leetcodeTemplates';
import { JavaExecutor } from '../backend/src/services/javaExecutor';
import { PythonExecutor } from '../backend/src/services/pythonExecutor';

const hasJava = spawnSync('javac', ['-version']).status === 0;
const hasPython = spawnSync('python3', ['--version']).status === 0;

test('standard template imports preserve existing imports, aliases, and future statements', () => {
    for (const code of [
        'import java.util.List;\nclass Solution { List<Integer> value; }',
        'import java.util.*;\nclass Solution { List<Integer> value; }',
        'import custom.List;\nclass Solution { List value; }',
    ]) assert.equal(addJavaStandardImports(code), code);
    for (const code of [
        'from typing import List\nclass Solution:\n    def echo(self, data: List[int]): pass',
        'from typing import (\n    List,\n    Optional,\n)\nvalue: Optional[List[int]]',
        'from custom import List\nvalue: List',
        'from typing import *\nvalue: List[int]',
        'import typing\nvalue: typing.List[int]',
    ]) assert.equal(addPythonStandardImports(code), code);
    assert.match(addJavaStandardImports('package example; class Solution { List<Integer> value; }'),
        /^package example;\nimport java.util.List;\n class Solution/);
    const future = 'from __future__ import annotations\nclass Solution:\n    def echo(self, data: List[int]): pass';
    assert.match(addPythonStandardImports(future), /^from __future__ import annotations\nfrom typing import List\n/);
    assert.equal(addJavaStandardImports('class Solution { int echo(int data) { return data; } }'),
        'class Solution { int echo(int data) { return data; } }');
});

test('imported List templates execute after filling only their solution bodies', async t => {
    const question = {
        questionFrontendId: '1', title: 'Echo', content: '<p>Echo.</p><p><strong>Example 1:</strong></p>' +
            '<pre><strong>Input:</strong> data = [1,2]\n<strong>Output:</strong> [1,2]</pre>',
        difficulty: 'Easy', topicTags: [], exampleTestcaseList: ['[1,2]'],
        metaData: JSON.stringify({ name: 'echo', params: [{ name: 'data', type: 'list<integer>' }], return: { type: 'list<integer>' } }),
        codeSnippets: [
            { langSlug: 'java', code: 'class Solution { public List<Integer> echo(List<Integer> data) { /* body */ } }' },
            { langSlug: 'python3', code: 'class Solution:\n    def echo(self, data: List[int]) -> List[int]:\n        pass' },
        ],
    };
    t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data: { question } })));
    const imported = await new LeetCodeService().importProblem('https://leetcode.com/problems/echo/');
    assert.match(imported.templates.java, /^import java.util.List;\n/);
    assert.match(imported.templates.python3, /^from typing import List\n/);
    await t.test('Java', { skip: !hasJava }, async () => {
        const result = await new JavaExecutor().executeCode(imported.templates.java.replace('/* body */', 'return data;'),
            imported.visibleTestcases, true, imported.metadata);
        assert.equal(result.status, 'AC', JSON.stringify(result));
    });
    await t.test('Python', { skip: !hasPython }, async () => {
        const result = await new PythonExecutor().executeCode(imported.templates.python3.replace('pass', 'return data'),
            imported.visibleTestcases, true, imported.metadata);
        assert.equal(result.status, 'AC', JSON.stringify(result));
    });
});
