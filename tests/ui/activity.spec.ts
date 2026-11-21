import { test, expect } from '@playwright/test';

test('submit through the real judge, inspect both code snapshots and filter daily activity', async ({ page, context }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/problems/activity-sum');
    await expect(page.locator('.monaco-editor')).toBeVisible();
    const submit = page.getByRole('button', { name: 'Submit', exact: true });
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page.getByText('Wrong Answer', { exact: true })).toBeVisible();
    await submit.click();
    await expect(page.getByText('Wrong Answer', { exact: true })).toBeVisible();
    await expect(submit).toBeEnabled();
    const correct = 'class Solution:\n    def sum(self, a, b):\n        return a + b';
    await page.evaluate(async source => {
        const modulePath = '/src/services/monacoSetup.ts';
        const { monaco } = await import(/* @vite-ignore */ modulePath);
        monaco.editor.getEditors()[0].setValue(source);
    }, correct);
    await submit.click();
    await expect(page.locator('.result-title')).toHaveText('Accepted');
    await expect(submit).toBeEnabled();
    await page.getByRole('link', { name: 'Submission history' }).click();
    await expect(page).toHaveURL(/\/activity\?problemId=activity-sum/);
    await expect(page).toHaveTitle('JustCode');
    const table = page.getByRole('table', { name: 'Submission history' });
    await expect(table.locator('tbody tr')).toHaveCount(2);
    const totals = page.getByLabel('Selected period totals');
    await expect(totals.locator('dd')).toHaveText(['2', '1', '1', '1']);
    await expect(page.getByRole('table', { name: 'Daily practice' }).locator('tbody td')).toHaveText(['2', '1', '1', '1']);
    await page.screenshot({ path: info.outputPath('activity.png') });

    await table.getByRole('row').filter({ hasText: 'Accepted' }).getByRole('button').click();
    const dialog = page.getByRole('dialog', { name: 'Submission details' });
    await expect(dialog.locator('.submission-code')).toHaveText(correct);
    await expect(dialog).not.toContainText('104321');
    await dialog.getByRole('button', { name: 'Copy code' }).click();
    await expect(dialog.getByRole('button', { name: 'Copied code' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(correct);
    await page.keyboard.press('Escape');
    await table.getByRole('row').filter({ hasText: 'Wrong Answer' }).getByRole('button').click();
    await expect(dialog.locator('.submission-code')).toContainText('return a - b');
    await dialog.getByRole('button', { name: 'Close' }).click();

    await page.getByLabel('Language').selectOption('java');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByText('No submissions match this view.')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Language')).toHaveValue('java');
    await page.getByLabel('Language').selectOption('python3');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 800 });
    await expect(page.getByRole('button', { name: 'Apply filters' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
});

test('Activity retries failed queries and pages through historical submissions', async ({ page }) => {
    await page.route('**/api/stats/daily?**', route => route.fulfill({ json: { days: [], totals: { submissions: 51, accepted: 51,
        practicedProblems: 1, solvedProblems: 1 }, hasLegacy: true } }));
    let fail = true;
    await page.route('**/api/submissions?**', route => {
        if (fail) { fail = false; return route.fulfill({ status: 503, json: { error: 'History temporarily unavailable' } }); }
        const n = Number(new URL(route.request().url()).searchParams.get('page'));
        const item = { id: 'legacy', problemId: 'old-problem', language: 'java', source: 'legacy', state: 'completed',
            submittedAt: '2024-11-03T05:00:00Z', verdict: 'AC', passedTestcases: 1, totalTestcases: 1 };
        return route.fulfill({ json: { items: [item], total: 51, page: n, limit: 50 } });
    });
    await page.route('**/api/submissions/legacy', route => route.fulfill({ json: { id: 'legacy', problemId: 'old-problem',
        language: 'java', submittedAt: '2024-11-03T05:00:00Z', state: 'completed', verdict: 'AC', passedTestcases: 1, totalTestcases: 1,
        code: null, source: 'legacy', result: null, submitDurationMs: null, durationMs: 100, judgeDurationMs: null } }));
    await page.goto('/activity?from=&to=');
    await expect(page.getByRole('alert')).toContainText('History temporarily unavailable');
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText(/Earlier versions recorded only accepted/)).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Page 2 of 2')).toBeVisible();
    await page.getByRole('button', { name: 'View old-problem submission' }).click();
    await expect(page.getByText('Code was not recorded.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy code' })).toHaveCount(0);
});
