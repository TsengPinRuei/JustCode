import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs/promises';

const metadata = {
    id: 'add-two-integers', title: 'Add Two Integers', difficulty: 'Easy', tags: ['Math'],
    description: 'Add two integers. A `number` example.',
    examples: [{ input: 'a = 1, b = 2', output: '3' }], constraints: ['-100 <= a, b <= 100'],
    supportedLanguages: ['java', 'python3'], functionSignatures: { java: '', python3: '' },
    functionName: 'sum', params: [{ name: 'a', type: 'integer' }, { name: 'b', type: 'integer' }], returnType: 'integer',
};
const problem = {
    metadata,
    templates: { java: 'class Solution {}', python3: 'class Solution:\n    pass' },
    visibleTestcases: [{ input: { a: 1, b: 2 }, output: 3 }],
};
const accepted = { status: 'AC', message: 'All tests passed', testcaseResults: [], passedTestcases: 1, totalTestcases: 1 };

async function setup(page: Page) {
    const saves: any[] = [];
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
    await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/progress' && route.request().method() === 'GET') return route.fulfill({ json: {} });
        if (url.pathname.startsWith('/api/progress/')) {
            if (route.request().method() === 'PUT') saves.push(route.request().postDataJSON());
            return route.fulfill({ json: null });
        }
        if (url.pathname === '/api/problems') return route.fulfill({ json: [metadata] });
        if (url.pathname.startsWith('/api/problems/')) return route.fulfill({ json: problem });
        if (url.pathname === '/api/run' || url.pathname === '/api/submit') return route.fulfill({ json: accepted });
        return route.fulfill({ status: 500, json: { error: 'Unexpected test request' } });
    });
    return saves;
}

async function openWorkspace(page: Page) {
    await page.goto('/problems/add-two-integers');
    await expect(page.locator('.monaco-editor')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
}

async function monacoAction(page: Page, action: 'edit' | 'undo' | 'redo' | 'value' | 'markers' | 'models', text?: string): Promise<any> {
    return page.evaluate(async ({ action, text }) => {
        // Exercise the real bundled editor; API responses alone are mocked.
        const modulePath = '/src/services/monacoSetup.ts';
        const { monaco } = await import(/* @vite-ignore */ modulePath);
        const editor = monaco.editor.getEditors()[0];
        if (action === 'edit') {
            editor.pushUndoStop();
            editor.executeEdits('ui-test', [{ range: editor.getModel().getFullModelRange(), text }]);
            editor.pushUndoStop();
        } else if (action === 'undo' || action === 'redo') editor.trigger('ui-test', action, null);
        else if (action === 'markers') return monaco.editor.getModelMarkers({ owner: 'compilation' });
        else if (action === 'models') return monaco.editor.getModels().map((model: any) => model.uri.toString());
        return editor.getValue();
    }, { action, text });
}

function deferredRoute() {
    let resolve!: () => void;
    const ready = new Promise<void>(res => { resolve = res; });
    let pending!: Route;
    return { ready, handle: async (route: Route) => { pending = route; resolve(); }, abort: () => pending.abort('failed'), succeed: (body: object) => pending.fulfill({ json: body }), finish: (status = 400) => pending.fulfill({ status, json: { error: 'Old request failed' } }) };
}

test('keyboard links enter bundled problems; delete keeps the list route', async ({ page }) => {
    await setup(page);
    const imported = { ...metadata, id: 'imported', title: 'Imported Problem' };
    await page.route('**/api/problems', route => route.fulfill({ json: [metadata, imported] }));
    let deleted = 0;
    await page.route('**/api/problems/imported', route => { deleted++; return route.fulfill({ json: { success: true } }); });
    await page.goto('/problems');
    await page.getByRole('button', { name: 'Import from LeetCode' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Add Two Integers' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/problems\/add-two-integers$/);
    await page.getByRole('link', { name: 'Problems', exact: true }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Delete Imported Problem' }).click();
    await expect(page.getByRole('link', { name: 'Imported Problem' })).toHaveCount(0);
    expect(deleted).toBe(1);
    await expect(page).toHaveURL(/\/problems$/);
    await expect(page.locator('.delete-icon')).toHaveCount(0);
});

test('successful import with failed refresh retries GET without a second POST', async ({ page }) => {
    await setup(page);
    let gets = 0, posts = 0;
    const imported = { ...metadata, id: 'imported', title: 'Imported Problem' };
    await page.route('**/api/problems', route => {
        gets++;
        return gets === 2 ? route.fulfill({ status: 500, json: { error: 'Refresh failed' } })
            : route.fulfill({ json: gets > 2 ? [metadata, imported] : [metadata] });
    });
    await page.route('**/api/import-problem', route => { posts++; return route.fulfill({ json: { success: true, problemId: 'imported', title: 'Imported Problem' } }); });
    await page.goto('/problems');
    await page.getByRole('button', { name: 'Import from LeetCode' }).click();
    await page.getByLabel('LeetCode problem URL').fill('https://leetcode.com/problems/imported/');
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.getByText('Successfully imported: Imported Problem')).toBeVisible();
    await expect(page.getByText('The problem was imported, but the list could not be refreshed.')).toBeVisible();
    await expect(page.locator('.import-error')).toHaveCount(0);
    await page.getByRole('button', { name: 'Reload list' }).click();
    await expect(page.getByRole('button', { name: 'Reload list' })).toHaveCount(0);
    expect(posts).toBe(1);
    await page.getByRole('button', { name: 'Close import dialog' }).click();
    await expect(page.getByRole('link', { name: 'Imported Problem' })).toHaveCount(1);
});

test('dialogs contain focus, restore it, block busy Escape, and keyboard file selection works', async ({ page }) => {
    await setup(page);
    await page.goto('/problems');
    const trigger = page.getByRole('button', { name: 'Import from LeetCode' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Import from LeetCode' });
    await expect(page.getByLabel('LeetCode problem URL')).toBeFocused();
    for (let i = 0; i < 16; i++) {
        await page.keyboard.press(i < 8 ? 'Tab' : 'Shift+Tab');
        expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    }
    await page.getByRole('button', { name: 'Close import dialog' }).focus();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await openWorkspace(page);
    const hiddenTrigger = page.getByRole('button', { name: 'Add Hidden Tests' });
    // Arm Chromium's file chooser interception before opening the dialog.
    const chooserPromise = page.waitForEvent('filechooser');
    await hiddenTrigger.click();
    const hiddenDialog = page.getByRole('dialog', { name: 'Add Hidden Tests' });
    await expect(hiddenDialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Append', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Project Path', exact: true }).click();
    await expect(page.getByLabel('Project-relative JSON path')).toBeVisible();
    await expect(page.getByLabel('Hidden testcase JSON')).toBeHidden();
    await page.getByRole('button', { name: 'Paste JSON' }).click();
    await expect(page.getByRole('button', { name: 'Paste JSON' })).toHaveAttribute('aria-pressed', 'true');
    await hiddenDialog.getByLabel('Hidden testcase file').dispatchEvent('cancel', { bubbles: true, cancelable: false });
    await expect(hiddenDialog).toBeVisible();
    const chooseFile = hiddenDialog.getByRole('button', { name: 'Choose File' });
    // focus() alone only waits for attachment. Confirm the newly selected pane
    // is visible and its button actually owns focus before sending a keyboard action.
    await expect(chooseFile).toBeVisible();
    await chooseFile.focus();
    await expect(chooseFile).toBeFocused();
    await chooseFile.press('Enter');
    const chooser = await chooserPromise;
    const contents = '[{"input":{"a":1,"b":2},"output":3}]';
    await chooser.setFiles({ name: 'test.json', mimeType: 'application/json', buffer: Buffer.from(contents) });
    await expect(page.getByLabel('Hidden testcase JSON')).toHaveValue(contents);
    const pending = deferredRoute();
    await page.route('**/hidden-testcases', pending.handle);
    await page.getByRole('button', { name: 'Import Hidden Tests' }).click();
    await pending.ready;
    await page.keyboard.press('Escape');
    await expect(hiddenDialog).toBeVisible();
    await pending.finish();
    await expect(page.getByRole('button', { name: 'Close hidden tests dialog' })).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(hiddenDialog).toHaveCount(0);
    await expect(hiddenTrigger).toBeFocused();
});

for (const change of ['code', 'language', 'none'] as const) {
    test(`HTTP errors only belong to unchanged buffers (${change}) and Run has one busy label`, async ({ page }) => {
        await setup(page);
        const pending = deferredRoute();
        await page.route('**/api/run', pending.handle);
        await openWorkspace(page);
        await page.getByRole('button', { name: 'Run', exact: true }).click();
        await pending.ready;
        await expect(page.getByRole('button', { name: 'Running...' })).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeDisabled();
        if (change === 'code') await monacoAction(page, 'edit', 'class Solution { /* new draft */ }');
        if (change === 'language') await page.getByLabel('Language', { exact: true }).selectOption('python3');
        await pending.finish();
        await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
        if (change === 'none') await expect(page.getByText('Old request failed')).toBeVisible();
        else await expect(page.getByText('Old request failed')).toHaveCount(0);
    });
}

test('Submit alone shows its busy state and a stale server error is ignored', async ({ page }) => {
    await setup(page);
    const pending = deferredRoute();
    await page.route('**/api/submit', pending.handle);
    await openWorkspace(page);
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await pending.ready;
    await expect(page.getByRole('button', { name: 'Submitting...' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeDisabled();
    await monacoAction(page, 'edit', 'class Solution { /* edited during submit */ }');
    await pending.finish(500);
    await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeEnabled();
    await expect(page.getByText('Old request failed')).toHaveCount(0);
});

test('retry uses the same submission ID and an accepted response preserves edits made while judging', async ({ page }) => {
    const saves = await setup(page);
    const attempts: { code: string; submissionId: string }[] = [];
    const judge = deferredRoute();
    let finished = false;
    await page.route('**/api/submit', route => {
        attempts.push(route.request().postDataJSON());
        return attempts.length === 1 ? route.abort('failed') : judge.handle(route);
    });
    await page.route('**/api/progress/add-two-integers', route => {
        if (!finished || route.request().method() !== 'GET') return route.fallback();
        return route.fulfill({ json: { status: 'solved', selectedLanguage: 'java', code: { java: attempts[0].code },
            solveRecords: [{ id: attempts[0].submissionId, language: 'java', solvedAt: '2024-03-01T00:00:00Z',
                passedTestcases: 1, totalTestcases: 1 }], lastUpdated: '2024-03-01T00:00:00Z' } });
    });
    await openWorkspace(page);
    const submit = page.getByRole('button', { name: 'Submit', exact: true });
    await submit.click();
    await page.getByRole('button', { name: 'Retry submission' }).click();
    await judge.ready;
    expect(attempts[1]).toEqual(attempts[0]);
    expect(attempts[0].submissionId).toMatch(/^[0-9a-f-]{36}$/);
    const edited = 'class Solution { /* next version */ }';
    await monacoAction(page, 'edit', edited);
    finished = true;
    await judge.succeed({ ...accepted, state: 'completed', submissionId: attempts[0].submissionId });
    await expect(submit).toBeEnabled();
    expect(await monacoAction(page, 'value')).toBe(edited);
    await expect(page.locator('.result-title')).toHaveCount(0);
    await page.getByRole('button', { name: /^Stats/ }).click();
    await expect(page.locator('.solve-stat-item').filter({ hasText: 'Records' }).locator('strong')).toHaveText('1');
    await expect.poll(() => saves.at(-1)?.code.java).toBe(edited);
    expect(saves.at(-1)).not.toHaveProperty('solveRecords');
    expect(saves.at(-1).status).toBe('attempted');
});

test('network errors from an old language do not replace current results', async ({ page }) => {
    await setup(page);
    const pending = deferredRoute();
    await page.route('**/api/run', pending.handle);
    await openWorkspace(page);
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Running...' })).toBeVisible();
    await page.getByLabel('Language', { exact: true }).selectOption('python3');
    await pending.ready;
    await pending.abort();
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
    await expect(page.getByText('Network Error', { exact: true })).toHaveCount(0);
});

test('generated diagnostics retain their origin without marking Solution; user diagnostics mark correctly', async ({ page }) => {
    await setup(page);
    let file = 'Runner.java';
    await page.route('**/api/run', route => route.fulfill({ json: {
        status: 'CE', message: 'Compilation failed', testcaseResults: [], totalTestcases: 1, passedTestcases: 0,
        compilationErrors: [{ file, line: file === 'Runner.java' ? 11 : 1, column: 1, severity: 'error', message: 'Cannot convert argument' }],
    } }));
    await openWorkspace(page);
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page.getByText('Runner.java:11:1')).toBeVisible();
    expect(await monacoAction(page, 'markers')).toEqual([]);
    file = 'Solution.java';
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page.getByText('Solution.java:1:1')).toBeVisible();
    await expect.poll(async () => (await monacoAction(page, 'markers')).length).toBe(1);
    await page.getByLabel('Language', { exact: true }).selectOption('python3');
    expect(await monacoAction(page, 'markers')).toEqual([]);
    file = 'solution.py';
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page.getByText('solution.py:1:1')).toBeVisible();
    await expect.poll(async () => (await monacoAction(page, 'markers')).length).toBe(1);
});

test('Java and Python undo stacks, drafts, and models remain isolated', async ({ page }) => {
    const saves = await setup(page);
    await openWorkspace(page);
    await monacoAction(page, 'edit', 'class Solution { /* JAVA */ }');
    await page.getByLabel('Language', { exact: true }).selectOption('python3');
    await monacoAction(page, 'undo');
    expect(await monacoAction(page, 'value')).toBe(problem.templates.python3);
    await monacoAction(page, 'edit', 'class Solution:\n    # PYTHON\n    pass');
    await monacoAction(page, 'undo');
    expect(await monacoAction(page, 'value')).toBe(problem.templates.python3);
    await monacoAction(page, 'redo');
    expect(await monacoAction(page, 'value')).toContain('# PYTHON');
    await page.getByLabel('Language', { exact: true }).selectOption('java');
    expect(await monacoAction(page, 'value')).toContain('JAVA');
    await monacoAction(page, 'undo');
    expect(await monacoAction(page, 'value')).toBe(problem.templates.java);
    await monacoAction(page, 'redo');
    expect(await monacoAction(page, 'value')).toContain('JAVA');
    await page.getByLabel('Language', { exact: true }).selectOption('python3');
    await expect.poll(() => saves.at(-1)?.code.python3).toContain('# PYTHON');
    expect(saves.every(save => !save.code.python3?.includes('JAVA') && !save.code.java?.includes('# PYTHON'))).toBe(true);
    expect((await monacoAction(page, 'models')).length).toBe(2);
    await page.getByRole('link', { name: 'Problems', exact: true }).click();
    await expect.poll(async () => await monacoAction(page, 'models')).toEqual([]);
});

test('direct routes and back/forward navigation preserve pending saves per problem', async ({ page }) => {
    await setup(page);
    const second = { ...problem, metadata: { ...metadata, id: 'second', title: 'Second Problem' }, templates: { java: 'class Second {}', python3: 'class Second: pass' } };
    const stored: Record<string, any> = {};
    let releaseSave!: () => void;
    let saveStarted!: () => void;
    const pendingSave = new Promise<void>(resolve => { releaseSave = resolve; });
    const started = new Promise<void>(resolve => { saveStarted = resolve; });
    await page.route('**/api/problems', route => route.fulfill({ json: [metadata, second.metadata] }));
    await page.route('**/api/problems/second', route => route.fulfill({ json: second }));
    await page.route('**/api/progress/*', async route => {
        const id = new URL(route.request().url()).pathname.split('/').pop()!;
        if (route.request().method() === 'PUT') {
            saveStarted();
            await pendingSave;
            stored[id] = route.request().postDataJSON();
        }
        await route.fulfill({ json: stored[id] ?? null });
    });
    await openWorkspace(page);
    await monacoAction(page, 'edit', 'class Solution { /* KEEP PENDING */ }');
    await page.getByRole('link', { name: 'Problems', exact: true }).click();
    await started;
    await page.goBack();
    await expect(page.getByText('Loading problem...')).toBeVisible();
    releaseSave();
    await expect(page.locator('.monaco-editor')).toBeVisible();
    expect(await monacoAction(page, 'value')).toContain('KEEP PENDING');
    await page.goForward();
    await page.getByRole('link', { name: 'Second Problem', exact: true }).click();
    await expect(page.locator('.monaco-editor')).toBeVisible();
    expect(await monacoAction(page, 'value')).toBe(second.templates.java);
    expect(await monacoAction(page, 'models')).toEqual(['justcode:/second/Solution.java']);
    await page.getByRole('link', { name: 'Problems', exact: true }).click();
    await page.getByRole('link', { name: 'Add Two Integers', exact: true }).click();
    await expect(page.locator('.monaco-editor')).toBeVisible();
    expect(await monacoAction(page, 'value')).toContain('KEEP PENDING');
});

test('a failed save survives route navigation and retries the latest draft', async ({ page }) => {
    await setup(page);
    let failing = true;
    let stored: any = null;
    await page.route('**/api/progress/add-two-integers', async route => {
        if (route.request().method() === 'PUT') {
            if (failing) return route.fulfill({ status: 500, json: { error: 'Save unavailable' } });
            stored = route.request().postDataJSON();
        }
        return route.fulfill({ json: stored });
    });
    await openWorkspace(page);
    await monacoAction(page, 'edit', 'class Solution { /* KEEP UNSAVED */ }');
    await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible();
    await page.getByRole('link', { name: 'Problems', exact: true }).click();
    // Wait for React to commit the list route; going back earlier can cancel
    // that transition and keep the original workspace mounted without a retry.
    await expect(page.getByRole('link', { name: 'Add Two Integers', exact: true })).toBeVisible();
    expect(stored).toBeNull();
    failing = false;
    await page.goBack();
    await expect(page).toHaveURL(/\/problems\/add-two-integers$/);
    await expect(page.locator('.monaco-editor')).toBeVisible();
    expect(await monacoAction(page, 'value')).toContain('KEEP UNSAVED');
    await expect.poll(() => stored?.code.java).toContain('KEEP UNSAVED');
    await expect(page.getByRole('button', { name: 'Retry save' })).toHaveCount(0);
});

test('lossless numbers remain distinct in results, custom input, and downloaded briefs', async ({ page }) => {
    await setup(page);
    const source = JSON.stringify(problem).replace('"output":3', '"output":9007199254740993').replace('"a":1', '"a":9007199254740993');
    await page.route('**/api/problems/add-two-integers', route => route.fulfill({ body: source, contentType: 'application/json' }));
    await page.route('**/api/run', route => route.fulfill({ body: '{"status":"WA","message":"Different integers","totalTestcases":1,"passedTestcases":0,"testcaseResults":[{"index":1,"status":"Failed","expected":9007199254740992,"actual":9007199254740993}]}', contentType: 'application/json' }));
    await openWorkspace(page);
    await page.getByRole('button', { name: 'Custom Input', exact: true }).click();
    expect(await page.getByLabel('Enter your custom input (JSON format):').inputValue()).toContain('9007199254740993');
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page.locator('.testcase-result-value').nth(0)).toHaveText('9007199254740992');
    await expect(page.locator('.testcase-result-value').nth(1)).toHaveText('9007199254740993');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Description' }).click();
    const download = await downloadPromise;
    expect(await fs.readFile((await download.path())!, 'utf8')).toContain('9007199254740993');
});

test('imported explanation images and links render safely and remain in downloaded briefs', async ({ page }) => {
    await setup(page);
    const richProblem = {
        ...problem,
        metadata: {
            ...metadata,
            examples: [{ input: 'text = "<tag>*literal*</tag>"', output: '"Explanation: literal"', explanation: 'See [diagram source](https://example.com/source). ![example diagram](https://example.com/diagram.png) [unsafe](javascript:alert(1))' }],
        },
    };
    await page.route('**/api/problems/add-two-integers', route => route.fulfill({ json: richProblem }));
    await page.route('https://example.com/diagram.png', route => route.fulfill({ status: 204 }));
    await openWorkspace(page);
    await expect(page.getByRole('link', { name: 'diagram source' })).toHaveAttribute('href', 'https://example.com/source');
    await expect(page.getByAltText('example diagram')).toHaveAttribute('src', 'https://example.com/diagram.png');
    expect(await page.getByText('unsafe', { exact: true }).getAttribute('href')).not.toMatch(/^javascript:/);
    await expect(page.locator('.example-content').first()).toHaveText('text = "<tag>*literal*</tag>"');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Description' }).click();
    const download = await downloadPromise;
    const text = await fs.readFile((await download.path())!, 'utf8');
    expect(text).toContain('![example diagram](https://example.com/diagram.png)');
    expect(text).toContain('[diagram source](https://example.com/source)');
});

test('desktop minimum and doubled interface zoom keep controls reachable; text contrast meets 4.5', async ({ page }) => {
    await setup(page);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1200, height: 720 });
    await openWorkspace(page);
    expect(await page.title()).toContain('JustCode');
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    for (const zoom of ['1.15', '2.3']) {
        await page.evaluate(zoom => { document.body.style.zoom = zoom; }, zoom);
        const run = page.getByRole('button', { name: 'Run', exact: true });
        await run.focus();
        await expect(run).toBeInViewport();
        await page.keyboard.press('Enter');
        await expect(page.getByText('All tests passed')).toBeVisible();
        await page.getByLabel('Language', { exact: true }).focus();
        await expect(page.getByLabel('Language', { exact: true })).toBeInViewport();
    }
    await page.setViewportSize({ width: 600, height: 360 });
    await page.evaluate(() => { document.body.style.zoom = '1.15'; });
    await expect(page.locator('.problem-title-text')).toHaveCSS('flex-basis', 'auto');
    expect((await page.locator('.problem-title-text').boundingBox())!.height).toBeLessThan(100);
    await page.getByRole('button', { name: 'Run', exact: true }).focus();
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeInViewport();
    const ratios = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        const luminance = (hex: string) => {
            const values = hex.trim().replace('#', '').match(/../g)!.map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
            return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
        };
        return ['--text-tertiary', '--accent-blue'].flatMap(fg => ['--bg-secondary', '--bg-tertiary', '--bg-hover'].map(bg => {
            const l1 = luminance(style.getPropertyValue(fg)), l2 = luminance(style.getPropertyValue(bg));
            return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
        }));
    });
    expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5);
    expect(errors).toEqual([]);
});
