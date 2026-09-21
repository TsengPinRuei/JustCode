import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createApp } from '../backend/src/app';
import { createProblemRouter } from '../backend/src/routes/problemRoutes';
import { CodeExecutorFactory } from '../backend/src/services/codeExecutorFactory';
import { ProblemService } from '../backend/src/services/problemService';
import { LeetCodeService } from '../backend/src/services/leetcodeService';
import { ExecutionResult, ProblemMetadata, ProblemProgress } from '../backend/src/types';

test('API validates requests, protects local access and preserves judge failures', async t => {
    const metadata: ProblemMetadata = {
        id: 'test', title: 'Test', difficulty: 'Easy', tags: [], description: '', examples: [],
        constraints: [], supportedLanguages: ['python3'], functionSignatures: { java: '', python3: '' },
        functionName: 'sum', params: [{ name: 'a', type: 'int' }], returnType: 'int',
    };
    let saved: ProblemProgress | undefined;
    const service = {
        getAllProblems: async () => [metadata],
        getProblemMetadata: async () => metadata,
        getProblem: async () => ({ metadata, templates: {}, visibleTestcases: [], hiddenTestcases: [{ secret: true }] }),
        getProblemForRun: async () => ({ metadata, visibleTestcases: [{ input: { a: 1 }, output: 1 }] }),
        getProblemForExecution: async () => ({
            metadata, visibleTestcases: [{ input: { a: 1 }, output: 1 }], hiddenTestcases: [{ input: { a: 2 }, output: 2 }],
        }),
        saveProgress: async (_id: string, progress: ProblemProgress) => { saved = progress; },
        saveProblem: async () => { throw Object.assign(new Error('Already exists'), { code: 'EEXIST' }); },
    } as unknown as ProblemService;
    const importer = { importProblem: async () => ({ metadata }) } as unknown as LeetCodeService;
    let result: ExecutionResult = {
        status: 'WA', testcaseResults: [{ index: 0, status: 'Failed', actual: 42, expected: null }],
        totalTestcases: 1, passedTestcases: 0,
    };
    let execute = async () => result;
    t.mock.method(CodeExecutorFactory, 'getExecutor', () => ({ executeCode: () => execute() }));
    const server = createApp(createProblemRouter(service, importer)).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    const request = (path: string, body?: unknown, method = 'POST', headers: Record<string, string> = {}) =>
        fetch(base + path, {
            method, headers: { 'Content-Type': 'application/json', ...headers },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
    const valid = { problemId: 'test', language: 'python3', code: 'pass', inputMode: 'custom', customInput: '{"a":1}' };

    try {
        await t.test('rejects external origins and rebinding hosts; accepts local frontend', async () => {
            assert.equal((await request('/health', undefined, 'GET', { Origin: 'https://evil.example' })).status, 403);
            const reboundStatus = await new Promise<number | undefined>((resolve, reject) => {
                const req = httpRequest(base + '/health', { headers: { Host: 'evil.example' } }, response => {
                    response.resume();
                    resolve(response.statusCode);
                });
                req.on('error', reject);
                req.end();
            });
            assert.equal(reboundStatus, 403);
            assert.equal((await request('/health', undefined, 'GET', { Origin: 'null' })).status, 403);
            assert.equal((await request('/health', undefined, 'GET', { Origin: 'http://localhost:5173' })).status, 200);
            assert.equal((await request('/health', undefined, 'GET')).status, 200);
        });
        await t.test('rejects malformed bodies, invalid languages and custom input shapes', async () => {
            for (const body of [null, [], {}, { ...valid, problemId: '../test' }, { ...valid, language: 'ruby' },
                { ...valid, language: 'java' }, { ...valid, code: '' }, { ...valid, inputMode: 'other' },
                { ...valid, customInput: 'null' }, { ...valid, customInput: '[]' },
                { ...valid, customInput: '{}' }, { ...valid, customInput: '{"a":1,"b":2}' }]) {
                assert.equal((await request('/api/run', body)).status, 400, JSON.stringify(body));
            }
            const malformed = await fetch(base + '/api/run', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
            });
            assert.equal(malformed.status, 400);
            assert.equal((await request('/api/run')).status, 400);
        });
        await t.test('custom execution accepts returned values but retains infrastructure RE', async () => {
            const success = await (await request('/api/run', valid)).json();
            assert.equal(success.status, 'AC');
            assert.equal(success.testcaseResults[0].actual, 42);
            assert.equal('expected' in success.testcaseResults[0], false);
            result = { status: 'RE', message: 'Unable to start runtime', testcaseResults: [], totalTestcases: 1, passedTestcases: 0 };
            const failed = await (await request('/api/run', valid)).json();
            assert.equal(failed.status, 'RE');
            assert.equal(failed.passedTestcases, 0);
        });
        await t.test('rejects invalid progress before writing and assigns server timestamps', async () => {
            const progress = { status: 'attempted', code: { python3: 'pass' }, selectedLanguage: 'python3' };
            for (const body of [null, { ...progress, code: [] }, { ...progress, status: 'bad' }, { ...progress, status: ['solved'] },
                { ...progress, code: { python3: 42 } }, { ...progress, solveRecords: [{}] }]) {
                assert.equal((await request('/api/progress/test', body, 'PUT')).status, 400);
            }
            assert.equal(saved, undefined);
            assert.equal((await request('/api/progress/test', { ...progress, lastUpdated: 'invalid' }, 'PUT')).status, 200);
            assert(saved && Number.isFinite(Date.parse(saved.lastUpdated)));
        });
        await t.test('does not disclose hidden tests, delete builtins, or overwrite existing imports', async () => {
            const detail = await (await request('/api/problems/test', undefined, 'GET')).json();
            assert.equal('hiddenTestcases' in detail, false);
            assert.equal((await request('/api/problems/sort-array', undefined, 'DELETE')).status, 403);
            assert.equal((await request('/api/problems/SORT-ARRAY', undefined, 'DELETE')).status, 403);
            assert.equal((await request('/api/import-problem', { url: 'https://leetcode.com/problems/test/' })).status, 409);
        });
        await t.test('bounds concurrent executions and releases capacity after completion', async () => {
            let release!: () => void;
            const gate = new Promise<void>(resolve => { release = resolve; });
            let started = 0;
            let bothStarted!: () => void;
            const ready = new Promise<void>(resolve => { bothStarted = resolve; });
            execute = async () => {
                if (++started === 2) bothStarted();
                await gate;
                return result;
            };
            const first = request('/api/run', valid);
            const second = request('/api/run', valid);
            try {
                await ready;
                const busy = await request('/api/run', valid);
                assert.equal(busy.status, 429);
                assert.equal(busy.headers.get('retry-after'), '1');
            } finally {
                release();
                await Promise.all([first, second]);
            }
            execute = async () => result;
            assert.equal((await request('/api/run', valid)).status, 200);
        });
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
});
