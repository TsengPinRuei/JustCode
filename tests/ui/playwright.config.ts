import { defineConfig } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';

export default defineConfig({
    testDir: '.',
    testMatch: '*.spec.ts',
    fullyParallel: true,
    workers: 2,
    timeout: 30000,
    expect: { timeout: 8000 },
    reporter: 'list',
    outputDir: path.join(os.tmpdir(), 'justcode-ui-results'),
    use: {
        baseURL: 'http://127.0.0.1:5178',
        viewport: { width: 1440, height: 900 },
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
            ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : undefined,
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'npm run dev --workspace=frontend -- --host 127.0.0.1 --port 5178 --strictPort',
        cwd: path.resolve(__dirname, '../..'),
        url: 'http://127.0.0.1:5178',
        reuseExistingServer: !process.env.CI,
    },
});
