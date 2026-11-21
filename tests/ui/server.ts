import { promises as fs } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import { createApp } from '../../backend/src/app';
import { createProblemRouter } from '../../backend/src/routes/problemRoutes';
import { ProblemService } from '../../backend/src/services/problemService';

async function start() {
    const project = path.resolve(__dirname, '../..');
    const root = await fs.mkdtemp(path.join(tmpdir(), 'justcode-browser-'));
    process.chdir(root);
    const service = await ProblemService.open(root);
    await service.saveProblem('activity-sum', {
        metadata: { id: 'activity-sum', title: 'Activity Sum', difficulty: 'Easy', tags: ['Math'],
            description: 'Return the sum of two integers.', examples: [], constraints: [], supportedLanguages: ['python3', 'java'],
            functionName: 'sum', params: [{ name: 'a', type: 'int' }, { name: 'b', type: 'int' }], returnType: 'int',
            functionSignatures: { python3: 'def sum(self, a, b):', java: 'int sum(int a, int b)' } },
        templates: { python3: 'class Solution:\n    def sum(self, a, b):\n        return a - b', java: 'class Solution {}' },
        visibleTestcases: [{ input: { a: 1, b: 2 }, output: 3 }],
    });
    await service.importHiddenTestcases('activity-sum', { sourceType: 'content', mode: 'append',
        content: '[{"input":{"a":104321,"b":1},"output":104322}]' });
    const backend = createApp(createProblemRouter(service)).listen(0, '127.0.0.1');
    await once(backend, 'listening');
    const address = backend.address();
    if (!address || typeof address === 'string') throw new Error('Missing test backend port');
    const vite = await createServer({ root: path.join(project, 'frontend'), configFile: path.join(project, 'frontend/vite.config.ts'),
        server: { host: '127.0.0.1', port: 5178, strictPort: true, proxy: { '/api': { target: `http://127.0.0.1:${address.port}`, changeOrigin: true } } } });
    await vite.listen();
    const stop = async () => {
        await vite.close();
        backend.closeAllConnections();
        await new Promise<void>(resolve => backend.close(() => resolve()));
        service.practice.close();
        await fs.rm(root, { recursive: true, force: true });
    };
    process.once('SIGTERM', () => void stop());
    process.once('SIGINT', () => void stop());
}

void start().catch(error => { console.error(error); process.exit(1); });
