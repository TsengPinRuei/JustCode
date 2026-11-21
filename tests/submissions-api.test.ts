import assert from 'node:assert/strict';
import { once } from 'node:events';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { createApp } from '../backend/src/app';
import { createProblemRouter } from '../backend/src/routes/problemRoutes';
import { CodeExecutorFactory } from '../backend/src/services/codeExecutorFactory';
import { ProblemService } from '../backend/src/services/problemService';

function gate() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
}

test('HTTP admission, replay and disconnect persist exactly one authoritative result per accepted request', async t => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'justcode-submit-api-'));
    const service = await ProblemService.open(root);
    await service.saveProblem('sum', {
        metadata: { id: 'sum', title: 'Sum', difficulty: 'Easy', tags: [], description: '', examples: [], constraints: [],
            supportedLanguages: ['python3'], functionSignatures: { python3: 'def sum(self):', java: '' } },
        templates: { python3: 'pass' }, visibleTestcases: [{ input: {}, output: 1 }],
    });
    const server = createApp(createProblemRouter(service)).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}/api`;
    const api = (url: string, body?: object, method = body ? 'POST' : 'GET', signal?: AbortSignal) =>
        fetch(base + url, { method, signal, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const firstStarted = gate(), secondStarted = gate(), release = gate();
    const result = { status: 'AC', passedTestcases: 1, totalTestcases: 1, testcaseResults: [] };
    let calls = 0;
    t.mock.method(CodeExecutorFactory, 'getExecutor', () => ({ executeCode: async (code: string) => {
        calls++;
        if (code === 'infrastructure') return { ...result, status: 'RE', judgeError: true, message: 'Executor unavailable' };
        if (code === 'throw') throw new Error('Controlled judge failure');
        if (code === 'one' || code === 'two') {
            (code === 'one' ? firstStarted : secondStarted).resolve();
            await release.promise;
        }
        return result;
    } }));
    const req = (code: string) => ({ submissionId: randomUUID(), problemId: 'sum', language: 'python3', code });
    const first = req('one'), second = req('two');
    try {
        const abort = new AbortController();
        const disconnected = api('/submit', first, 'POST', abort.signal).catch(error => error);
        await firstStarted.promise;
        const pending = api('/submit', second);
        await secondStarted.promise;
        assert.equal((await api('/submit', first)).status, 202);
        assert.equal((await api('/submit', { ...first, code: 'different' })).status, 409);
        assert.equal((await api('/submit', req('busy'))).status, 429);
        assert.equal((await api('/problems/sum', undefined, 'DELETE')).status, 409);
        abort.abort();
        await disconnected;
        const draft = { status: 'attempted', selectedLanguage: 'python3', code: { python3: 'changed while running' } };
        assert.equal((await api('/progress/sum', draft, 'PUT')).status, 200);
        for (const body of [{ ...draft, status: 'solved' }, { ...draft, solveRecords: [] }]) {
            assert.equal((await api('/progress/sum', body, 'PUT')).status, 400);
        }
        release.resolve();
        assert.equal((await (await pending).json()).status, 'AC');
        // A disconnected client cannot signal that its handler finished; observe persistent state.
        for (let i = 0; i < 100 && service.practice.replay(first)?.state === 'running'; i++) await delay(10);
        const replay = await (await api('/submit', first)).json();
        assert.equal(replay.status, 'AC');
        assert.equal(replay.submissionId, first.submissionId);
        assert.equal(calls, 2);
        const detail = await (await api('/submissions/' + first.submissionId)).json();
        assert.equal(detail.code, 'one');
        assert.equal(detail.submitDurationMs, null);
        assert.equal((await api('/submissions/' + first.submissionId + '/timing', { submitDurationMs: 42, code: 'replace' }, 'PATCH')).status, 400);
        assert.equal((await api('/submissions/' + first.submissionId + '/timing', { submitDurationMs: 42 }, 'PATCH')).status, 200);
        const progress = await (await api('/progress/sum')).json();
        assert.equal(progress.status, 'solved');
        assert.equal(progress.code.python3, 'changed while running');
        assert.equal(progress.solveRecords.length, 2);
        assert.deepEqual(await (await api('/progress?view=status')).json(), { sum: 'solved' });
        assert.deepEqual((await (await api('/progress')).json()).sum, progress);
        assert.equal((await api('/submit', { ...req(''), code: ' ' })).status, 400);
        assert.equal((await api('/submit', { ...req('x'), language: 'java' })).status, 400);
        assert.equal((await api('/submit', { ...req('x'), submissionId: 'bad' })).status, 400);
        assert.equal((await api('/submit', req('throw'))).status, 500);
        assert.equal((await api('/run', { ...req('run only'), inputMode: 'visible' })).status, 200);
        const history = await (await api('/submissions')).json();
        assert.equal(history.total, 3);
        assert.equal(history.items.filter((row: { state: string }) => row.state === 'error').length, 1);
        assert.equal((await api('/submissions?limit=101')).status, 400);
        assert.equal((await api('/submissions/unknown')).status, 404);
        assert.deepEqual((await (await api('/stats/daily?language=python3&timezone=UTC')).json()).totals,
            { submissions: 3, accepted: 2, practicedProblems: 1, solvedProblems: 1 });

        const outage = req('infrastructure');
        const unavailable = await api('/submit', outage);
        assert.equal(unavailable.status, 503);
        const error = await unavailable.json();
        assert.equal(error.submissionId, outage.submissionId);
        assert.equal(error.state, 'error');
        assert.equal(service.practice.replay(outage)?.verdict, null);
        assert.deepEqual(await (await api('/submit', outage)).json(), error);

        // Fail the second statement of the completion transaction and verify the first rolls back.
        const db = new Database(path.join(root, 'data', 'justcode.sqlite'));
        try {
            db.exec(`CREATE TRIGGER reject_finish BEFORE UPDATE OF status ON progress WHEN NEW.status='solved' AND OLD.status='attempted'
                BEGIN SELECT RAISE(ABORT,'simulated disk write failure'); END`);
            db.prepare("UPDATE progress SET status='attempted' WHERE problemId='sum'").run();
            const failed = req('write failure');
            assert.equal((await api('/submit', failed)).status, 500);
            const saved = service.practice.replay(failed)!;
            assert.equal(saved.state, 'error');
            assert.equal(saved.result, null);
            assert.equal(saved.verdict, null);
            assert.equal((await service.getProgress('sum'))?.status, 'attempted');
        } finally { db.close(); }
    } finally {
        release.resolve();
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
        service.practice.close();
        await fs.rm(root, { recursive: true, force: true });
    }
});
