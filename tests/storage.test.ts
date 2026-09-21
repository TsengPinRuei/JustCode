import assert from 'node:assert/strict';
import { test } from 'node:test';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { ProblemService } from '../backend/src/services/problemService';
import { writeJsonAtomic } from '../backend/src/services/storage';
import { ProblemMetadata, ProblemProgress } from '../backend/src/types';

const metadata: ProblemMetadata = {
    id: 'example', title: 'Example', difficulty: 'Easy', tags: [], description: '', examples: [], constraints: [],
    supportedLanguages: ['python3'], functionSignatures: { java: '', python3: 'def solve(self, n: int) -> int' },
    functionName: 'solve', params: [{ name: 'n', type: 'int' }], returnType: 'int',
};
const data = { metadata, templates: { python3: 'class Solution: pass' }, visibleTestcases: [{ input: { n: 1 }, output: 1 }] };
const progress: ProblemProgress = {
    status: 'attempted', code: { python3: 'pass' }, selectedLanguage: 'python3', lastUpdated: '2026-09-21T00:00:00.000Z',
};

test('storage protects existing data and serializes concurrent mutations', async t => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'justcode-storage-'));
    const service = new ProblemService(root);
    const secondService = new ProblemService(root);
    const problemDir = path.join(root, 'problems', 'example');
    const hiddenFile = path.join(problemDir, 'testcases_hidden.json');
    const progressFile = path.join(problemDir, 'progress.json');
    try {
        await service.saveProblem('example', data);
        await t.test('concurrent append calls across service instances retain every testcase', async () => {
            await Promise.all(Array.from({ length: 20 }, (_, n) => (n % 2 ? service : secondService).importHiddenTestcases('example', {
                mode: 'append', sourceType: 'content', content: JSON.stringify([{ input: { n }, output: n }]),
            })));
            const cases = JSON.parse(await fs.readFile(hiddenFile, 'utf-8'));
            assert.equal(cases.length, 20);
            assert.deepEqual(cases.map((item: { output: number }) => item.output).sort((a: number, b: number) => a - b),
                Array.from({ length: 20 }, (_, n) => n));
        });
        await t.test('duplicate imports retain hidden cases, templates, and progress', async () => {
            await service.saveProgress('example', progress);
            const before = await Promise.all([hiddenFile, progressFile, path.join(problemDir, 'template.py')].map(file => fs.readFile(file, 'utf-8')));
            await assert.rejects(service.saveProblem('example', data), { code: 'EEXIST' });
            assert.deepEqual(await Promise.all([hiddenFile, progressFile, path.join(problemDir, 'template.py')].map(file => fs.readFile(file, 'utf-8'))), before);
        });
        await t.test('invalid imports do not publish partial problem directories', async () => {
            await assert.rejects(service.saveProblem('invalid', { ...data, metadata: { ...metadata, id: 'invalid' }, visibleTestcases: [] }), { code: 'EINVAL' });
            await assert.rejects(service.saveProblem('invalid', { ...data, metadata: { ...metadata, id: 'invalid', difficulty: ['Easy'] } as unknown as ProblemMetadata }), { code: 'EINVAL' });
            assert.deepEqual(await fs.readdir(path.join(root, 'problems')), ['example']);
        });
        await t.test('template write failure removes staging files without publishing a partial problem', async () => {
            const originalWrite = fs.writeFile;
            const write = t.mock.method(fs, 'writeFile', async (...args: Parameters<typeof fs.writeFile>) => {
                if (String(args[0]).endsWith('template.py')) throw new Error('simulated template write failure');
                return originalWrite(...args);
            });
            try {
                await assert.rejects(service.saveProblem('partial', { ...data, metadata: { ...metadata, id: 'partial' } }), /simulated template write failure/);
                assert.deepEqual(await fs.readdir(path.join(root, 'problems')), ['example']);
            } finally {
                write.mock.restore();
            }
        });
        await t.test('corrupt hidden cases block judging and append, while detail and run stay available', async () => {
            await fs.writeFile(hiddenFile, '{broken');
            await assert.rejects(service.getProblemForExecution('example'));
            await assert.rejects(service.importHiddenTestcases('example', {
                mode: 'append', sourceType: 'content', content: '[{"input":{"n":2},"output":2}]',
            }));
            assert.equal(await fs.readFile(hiddenFile, 'utf-8'), '{broken');
            assert.equal((await service.getProblemForRun('example')).visibleTestcases.length, 1);
            assert.equal('hiddenTestcases' in await service.getProblem('example'), false);
            await service.importHiddenTestcases('example', { mode: 'replace', sourceType: 'content', content: '[{"input":{"n":2},"output":2}]' });
            assert.equal((await service.getProblemForExecution('example')).hiddenTestcases?.length, 1);
        });
        await t.test('corrupt progress is reported and cannot be overwritten by autosave', async () => {
            for (const value of ['{broken', '{"status":"solved","code":{},"selectedLanguage":"python3","lastUpdated":"invalid","solveRecords":[{}]}']) {
                await fs.writeFile(progressFile, value);
                await assert.rejects(service.getProgress('example'));
                await assert.rejects(service.saveProgress('example', progress));
                assert.equal(await fs.readFile(progressFile, 'utf-8'), value);
            }
            await fs.writeFile(progressFile, JSON.stringify({ status: 'none', code: {}, selectedLanguage: '', lastUpdated: '', solveRecords: [] }));
            assert.equal(await service.getProgress('example'), null);
            await service.saveProgress('example', progress);
            assert.deepEqual(await service.getProgress('example'), progress);
        });
        await t.test('unrelated directories do not prevent listing valid progress', async () => {
            await fs.mkdir(path.join(root, 'problems', 'NOT-A-PROBLEM'));
            assert.deepEqual(Object.keys(await service.getAllProgress()), ['example']);
        });
        await t.test('invalid parameter shapes, paths and symlinks are rejected without outside writes', async () => {
            await assert.rejects(service.importHiddenTestcases('example', { mode: 'append', sourceType: 'content', content: '[{"input":{},"output":1}]' }), { code: 'EINVAL' });
            await assert.rejects(service.getProblemMetadata('../example'), { code: 'EINVAL' });
            await assert.rejects(service.importHiddenTestcases('example', {
                mode: 'replace', sourceType: 'projectPath', projectPath: '.',
            }), { code: 'EINVAL' });
            await assert.rejects(service.deleteProblem('EXAMPLE'), { code: 'EINVAL' });
            assert.equal((await service.getProblemMetadata('example')).id, 'example');
            const outside = path.join(root, 'outside');
            await fs.mkdir(outside);
            await fs.writeFile(path.join(outside, 'progress.json'), 'outside');
            await fs.symlink(outside, path.join(root, 'problems', 'linked'));
            await assert.rejects(service.saveProgress('linked', progress));
            await assert.rejects(service.deleteProblem('linked'));
            assert.equal(await fs.readFile(path.join(outside, 'progress.json'), 'utf-8'), 'outside');
            await fs.rm(hiddenFile);
            await fs.symlink(path.join(outside, 'progress.json'), hiddenFile);
            await assert.rejects(service.getProblemForExecution('example'));
            await assert.rejects(service.importHiddenTestcases('example', {
                mode: 'replace', sourceType: 'projectPath', projectPath: path.relative(root, path.join(tmpdir(), 'outside-project.json')),
            }));
        });
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test('failed atomic replacement keeps the previous file and removes temporary output', async t => {
    const directory = await fs.mkdtemp(path.join(tmpdir(), 'justcode-atomic-'));
    const file = path.join(directory, 'data.json');
    try {
        await writeJsonAtomic(file, { original: true });
        const rename = t.mock.method(fs, 'rename', async () => { throw new Error('simulated rename failure'); });
        await assert.rejects(writeJsonAtomic(file, { replacement: true }), /simulated rename failure/);
        rename.mock.restore();
        assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf-8')), { original: true });
        assert.deepEqual(await fs.readdir(directory), ['data.json']);
    } finally {
        await fs.rm(directory, { recursive: true, force: true });
    }
});
