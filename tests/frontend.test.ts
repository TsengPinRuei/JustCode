import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProblemDescription from '../frontend/src/components/ProblemDescription';
import type { Root, Code } from 'mdast';
import type { Problem, ProblemProgress } from '../frontend/src/types/index';
import { createProgressPersistence } from '../frontend/src/services/progressPersistence';
import remarkCodeGroup from '../frontend/src/plugins/remarkCodeGroup';

const progress = (code: string): ProblemProgress => ({
    code: { java: code }, selectedLanguage: 'java', status: 'attempted', lastUpdated: '',
});

function deferred() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

test('progress saves are ordered per problem while independent problems can save concurrently', async () => {
    const first = deferred();
    const calls: string[] = [];
    const store = createProgressPersistence(async (id, snapshot) => {
        calls.push(id + ':' + snapshot.code.java);
        if (snapshot.code.java === 'old') await first.promise;
    });
    const oldSave = store.save('one', progress('old'));
    const latestSave = store.save('one', progress('latest'));
    const otherSave = store.save('two', progress('other'));
    await setImmediate();
    assert.deepEqual(calls, ['one:old', 'two:other']);
    first.resolve();
    await Promise.all([oldSave, latestSave, otherSave]);
    assert.deepEqual(calls, ['one:old', 'two:other', 'one:latest']);
    assert.equal(store.hasUnsavedDrafts(), false);
});

test('reopening a problem waits for an in-flight save before loading progress', async () => {
    const pending = deferred();
    let saved: ProblemProgress | null = null;
    let reads = 0;
    const store = createProgressPersistence(async (_id, snapshot) => {
        await pending.promise;
        saved = snapshot;
    });
    const snapshot = progress('latest');
    const save = store.save('one', snapshot);
    const read = store.read('one', async () => { reads += 1; return saved; });
    await setImmediate();
    assert.equal(reads, 0);
    pending.resolve();
    await save;
    assert.equal(await read, snapshot);
    assert.equal(reads, 1);
});

test('failed saves retain the latest draft and do not poison later retries', async () => {
    let failing = true;
    const calls: string[] = [];
    const store = createProgressPersistence(async (_id, snapshot) => {
        calls.push(snapshot.code.java);
        if (failing) throw new Error('offline');
    });
    const snapshot = progress('unsaved');
    await assert.rejects(store.save('one', snapshot), /offline/);
    assert.equal(store.hasUnsavedDrafts('one'), true);
    assert.equal(await store.read('one', async () => { throw new Error('must not discard draft'); }), snapshot);
    const all = await store.readAll(async () => ({ one: progress('outdated') }));
    assert.equal(all.one, snapshot);
    failing = false;
    await store.save('one', progress('retried'));
    assert.deepEqual(calls, ['unsaved', 'retried']);
    assert.equal(store.hasUnsavedDrafts(), false);
});

test('completion of an older save does not clear a newer failed draft', async () => {
    const first = deferred();
    const store = createProgressPersistence(async (_id, snapshot) => {
        if (snapshot.code.java === 'old') await first.promise;
        else throw new Error('latest failed');
    });
    const old = store.save('one', progress('old'));
    const latest = progress('new');
    const failed = assert.rejects(store.save('one', latest), /latest failed/);
    first.resolve();
    await old;
    await failed;
    assert.equal(await store.read('one', async () => progress('old')), latest);
});

test('Markdown code grouping preserves standalone node metadata and untouched parent arrays', () => {
    const code: Code = { type: 'code', lang: 'java', meta: 'title=Example', value: 'first', data: { marker: 'keep' } };
    const tree: Root = { type: 'root', children: [code] };
    const children = tree.children;
    remarkCodeGroup()(tree);
    assert.equal(tree.children, children);
    assert.equal(tree.children[0], code);
    assert.equal(code.meta, 'title=Example');
    assert.equal(code.data?.marker, 'keep');
});

test('Markdown grouping respects repeated languages and nested code blocks', () => {
    const standalone: Code = { type: 'code', lang: 'python', value: 'second', meta: 'preserve' };
    const tree: Root = {
        type: 'root',
        children: [{
            type: 'blockquote',
            children: [
                { type: 'code', lang: 'java', value: 'java source' },
                { type: 'code', lang: 'python', value: 'python source' },
                standalone,
            ],
        }],
    };
    remarkCodeGroup()(tree);
    const block = tree.children[0];
    assert.equal(block.type, 'blockquote');
    if (block.type !== 'blockquote') throw new Error('expected blockquote');
    assert.equal(block.children.length, 2);
    const group = block.children[0];
    assert.equal(group.type, 'codeGroup');
    if (group.type !== 'codeGroup') throw new Error('expected code group');
    assert.deepEqual(JSON.parse(group.data.hProperties.languages), [
        { lang: 'java', value: 'java source' }, { lang: 'python', value: 'python source' },
    ]);
    assert.equal(block.children[1], standalone);
});

test('problem deletion waits for pending saves and clears only successfully deleted drafts', async () => {
    const pending = deferred();
    let removed = false;
    const store = createProgressPersistence(async () => { await pending.promise; throw new Error('offline'); });
    const failed = assert.rejects(store.save('one', progress('draft')), /offline/);
    const removal = store.remove('one', async () => { removed = true; });
    await setImmediate();
    assert.equal(removed, false);
    pending.resolve();
    await failed;
    await removal;
    assert.equal(removed, true);
    assert.equal(store.hasUnsavedDrafts(), false);
    await assert.rejects(store.save('one', progress('keep')), /offline/);
    await assert.rejects(store.remove('one', async () => { throw new Error('cannot delete'); }), /cannot delete/);
    assert.equal(store.hasUnsavedDrafts('one'), true);
});

test('problem example data preserves HTML-like text and Markdown punctuation literally', () => {
    const problem: Problem = {
        metadata: {
            id: 'literal', title: 'Literal data', difficulty: 'Easy', tags: [],
            description: 'Description',
            examples: [{ input: 'value = "<tag>*literal*</tag>"', output: '`value`' }],
            constraints: [], supportedLanguages: ['java'],
            functionSignatures: { java: '', python3: '' },
        },
        templates: { java: '', python3: '' },
        visibleTestcases: [],
    };
    const html = renderToStaticMarkup(createElement(ProblemDescription, {
        problem, progress: null, attemptStartedAt: 0,
    }));
    assert.match(html, /&lt;tag&gt;\*literal\*&lt;\/tag&gt;/);
    assert.match(html, /\x60value\x60/);
    assert.doesNotMatch(html, /<em>literal<\/em>/);
});
