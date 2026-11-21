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
        command: 'node --import tsx tests/ui/server.ts',
        env: { JUSTCODE_SANDBOX_MODE: 'local' },
        gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
        cwd: path.resolve(__dirname, '../..'),
        url: 'http://127.0.0.1:5178',
        reuseExistingServer: false,
    },
});
