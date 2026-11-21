import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test, type TestContext } from 'node:test';
import Database from 'better-sqlite3';
import { ProblemService } from '../backend/src/services/problemService';
import { backupPractice } from '../backend/src/services/practiceSchema';
import { activityFilter } from '../backend/src/services/activityQueries';
import type { Judgement } from '../backend/src/shared/activity';

const utc = { timezone: 'UTC' };
const request = (problemId: string) => ({ problemId, language: 'python3' as const, code: 'return 1', submissionId: randomUUID() });
const ac: Judgement = { status: 'AC', passedTestcases: 1, totalTestcases: 1, testcaseResults: [] };
const draft = { status: 'attempted' as const, selectedLanguage: 'python3' as const, code: { python3: 'new draft' }, lastUpdated: '2024-11-03T06:00:00Z' };

async function workspace(t: TestContext) {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'justcode-practice-'));
    const dir = path.join(root, 'problems', 'example');
    await fs.mkdir(dir, { recursive: true });
    let service: ProblemService | undefined;
    const close = () => { service?.practice.close(); service = undefined; };
    t.after(async () => { close(); await fs.rm(root, { recursive: true, force: true }); });
    return { root, dir, file: path.join(dir, 'progress.json'), close, open: async () => {
        close();
        service = await ProblemService.open(root);
        return service;
    } };
}

test('migration snapshots legacy JSON, imports only known facts and survives backup and reopen', async t => {
    const work = await workspace(t);
    const record = { id: 'old-1', solvedAt: '2024-11-03T05:30:00Z', language: 'java', durationMs: 1600, passedTestcases: 3, totalTestcases: 3 };
    const older = { ...record, id: 'old-0', durationMs: undefined, solvedAt: '2024-11-02T05:00:00Z' };
    const original = JSON.stringify({ ...draft, status: 'solved', solveRecords: [older, record] });
    await fs.writeFile(work.file, original);
    const blank = path.join(work.root, 'problems', 'blank');
    await fs.mkdir(blank);
    await fs.writeFile(path.join(blank, 'progress.json'), JSON.stringify({ status: 'none', code: {}, selectedLanguage: '', lastUpdated: '', solveRecords: [] }));
    const service = await work.open();
    assert.equal(await service.getProgress('blank'), null);
    const saved = await service.getProgress('example');
    assert.equal(saved?.lastUpdated, draft.lastUpdated);
    assert.deepEqual(saved?.code, draft.code);
    assert.deepEqual(saved?.solveRecords?.map(item => item.id), [older.id, record.id]);
    assert.equal(saved?.solveRecords?.[0].durationMs, undefined);
    const [row, withoutTiming] = service.practice.activity.list(utc, 1, 50).items;
    assert.equal(withoutTiming.durationMs, null);
    const detail = service.practice.activity.detail(row.id)!;
    assert.equal(detail.code, null);
    assert.equal(detail.result, null);
    assert.equal(detail.submitDurationMs, null);
    assert.equal(detail.durationMs, 1600);
    assert.equal(detail.source, 'legacy');
    assert.equal(detail.submittedAt, new Date(record.solvedAt).toISOString());
    const backupDir = path.join(work.root, 'data', 'backups');
    const [snapshot] = await fs.readdir(backupDir);
    assert.equal(await fs.readFile(path.join(backupDir, snapshot, 'example.json'), 'utf8'), original);
    assert.equal(await fs.readFile(work.file, 'utf8'), original);
    const backup = new Database(await backupPractice(work.root), { readonly: true });
    try {
        assert.equal(backup.pragma('integrity_check', { simple: true }), 'ok');
        assert.equal(backup.prepare('SELECT COUNT(*) FROM submissions').pluck().get(), 2);
        assert.equal(backup.prepare('SELECT code FROM drafts').pluck().get(), draft.code.python3);
    } finally { backup.close(); }
    await fs.writeFile(work.file, 'this retired file is never imported twice');
    assert.equal((await work.open()).practice.activity.list(utc, 1, 50).total, 2);
});

test('invalid legacy data and SQL migration failures leave originals and no partial schema', async t => {
    const work = await workspace(t);
    for (const invalid of ['{broken', JSON.stringify({ ...draft, lastUpdated: 'bad' })]) {
        await fs.writeFile(work.file, invalid);
        await assert.rejects(work.open(), /example.*progress.json/);
        assert.equal(await fs.readFile(work.file, 'utf8'), invalid);
    }
    await fs.writeFile(work.file, JSON.stringify(draft));
    const database = new Database(path.join(work.root, 'data', 'justcode.sqlite'));
    try {
        database.exec('CREATE TABLE submissions(id TEXT)');
        await assert.rejects(work.open(), /already exists/);
        assert.equal(database.pragma('user_version', { simple: true }), 0);
        assert.equal(database.prepare("SELECT 1 FROM sqlite_master WHERE name='progress'").get(), undefined);
        database.exec('DROP TABLE submissions');
    } finally { database.close(); }
    assert.deepEqual(await (await work.open()).getProgress('example'), draft);
});

test('each verdict, snapshot, browser time and solved status have independent lifetimes', async t => {
    const work = await workspace(t);
    const service = await work.open();
    const store = service.practice;
    for (const verdict of ['AC', 'WA', 'CE', 'RE', 'TLE'] as const) {
        const req = request('example');
        store.begin(req);
        await service.saveProgress('example', draft);
        store.complete(req, { ...ac, status: verdict, testcaseResults: [{ index: 1, status: 'Passed', actual: 9007199254740993n }] }, 43);
        assert.equal(store.replay(req)?.result?.testcaseResults[0].actual, 9007199254740993n);
        assert.equal(store.replay(req)?.code, req.code);
        assert.throws(() => store.replay({ ...req, language: 'java' }), /different content/);
        assert.equal(store.replay(req)?.submitDurationMs, null);
        store.timing(req.submissionId, 51, 1690);
        store.timing(req.submissionId, 123, 456);
        assert.equal(store.replay(req)?.submitDurationMs, 51);
        assert.equal(store.replay(req)?.judgeDurationMs, 43);
    }
    await service.saveProgress('example', draft);
    const progress = await service.getProgress('example');
    assert.equal(progress?.status, 'solved');
    assert.equal(progress?.solveRecords?.length, 1);
    assert.equal(progress?.code.python3, draft.code.python3);
    const interrupted = request('example');
    store.begin(interrupted);
    await assert.rejects(ProblemService.open(work.root), /locked/);
    assert.equal(store.replay(interrupted)?.state, 'running');
    const backup = new Database(await backupPractice(work.root), { readonly: true });
    try { assert.equal(backup.prepare('SELECT state FROM submissions WHERE id=?').pluck().get(interrupted.submissionId), 'running'); }
    finally { backup.close(); }
    const reopened = await work.open();
    assert.equal(reopened.practice.replay(interrupted)?.state, 'interrupted');
    assert.equal(reopened.practice.activity.list(utc, 1, 50).total, 6);
});

test('date, zone, language and problem filters agree across pagination, DST and distinct period totals', async t => {
    const work = await workspace(t);
    const service = await work.open();
    const sql = new Database(path.join(work.root, 'data', 'justcode.sqlite'));
    try {
        for (const [id, time, verdict, language] of [
            ['example', '2024-11-03T03:59:59.999Z', 'WA', 'java'], // Nov 2 in New York
            ['example', '2024-11-03T05:30:00.000Z', 'AC', 'java'], // both occurrences of 01:30
            ['other', '2024-11-03T06:30:00.000Z', 'AC', 'python3'],
            ['example', '2024-11-04T04:59:59.999Z', 'AC', 'java'],
            ['other', '2024-11-04T05:00:00.000Z', 'WA', 'java'],
        ] as const) {
            const req = { ...request(id), language };
            service.practice.begin(req);
            service.practice.complete(req, { ...ac, status: verdict }, 1);
            sql.prepare('UPDATE submissions SET submittedAt=? WHERE id=?').run(time, req.submissionId);
        }
        const filter = activityFilter({ timezone: 'America/New_York', from: '2024-11-03', to: '2024-11-03' });
        const queries = service.practice.activity;
        const expected = { submissions: 3, accepted: 3, practicedProblems: 2, solvedProblems: 2 };
        assert.deepEqual(queries.daily(filter).totals, expected);
        assert.deepEqual(queries.daily(filter).days, [{ date: '2024-11-03', ...expected }]);
        assert.deepEqual(queries.daily({ timezone: filter.timezone }).totals, { ...expected, submissions: 5 });
        assert.equal(queries.daily({ ...filter, timezone: 'Asia/Taipei' }).totals.accepted, 2);
        const restricted = { ...filter, language: 'java' as const, problemId: 'example' };
        const first = queries.list(restricted, 1, 1), second = queries.list(restricted, 2, 1);
        assert.equal(first.total, 2);
        assert.equal(queries.daily(restricted).totals.submissions, 2);
        assert.notEqual(first.items[0].id, second.items[0].id);
        assert.ok(first.items[0].submittedAt > second.items[0].submittedAt);
        assert.equal('code' in first.items[0], false);
        assert.equal('resultJson' in first.items[0], false);
        for (const bad of [{ timezone: 'Invalid/Nowhere' }, { from: '2026-02-31' }, { from: '2024-11-05', to: '2024-11-03' }]) {
            assert.throws(() => activityFilter(bad));
        }
    } finally { sql.close(); }
});

test('deletion refuses running submissions and completes a partially staged delete on restart', async t => {
    const work = await workspace(t);
    const service = await work.open();
    const req = request('example');
    service.practice.begin(req);
    await assert.rejects(service.deleteProblem('example'), /still running/);
    service.practice.complete(req, ac, 2);
    await service.saveProgress('example', draft);
    const rm = fs.rm.bind(fs);
    const failure = t.mock.method(fs, 'rm', async (file, options) => {
        if (String(file).includes('.delete-')) throw new Error('simulated cleanup failure');
        return rm(file, options);
    });
    try { await assert.rejects(service.deleteProblem('example'), /simulated/); }
    finally { failure.mock.restore(); }
    assert.equal(service.practice.pendingDeletes().length, 1);
    const reopened = await work.open();
    assert.deepEqual(await fs.readdir(path.dirname(work.dir)), []);
    assert.deepEqual(reopened.practice.pendingDeletes(), []);
    assert.equal(reopened.practice.activity.list(utc, 1, 50).total, 0);
    await fs.mkdir(work.dir);
    assert.equal(await reopened.getProgress('example'), null);
});
