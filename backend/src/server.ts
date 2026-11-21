import { createApp } from './app';
import { createProblemRouter } from './routes/problemRoutes';
import { ProblemService } from './services/problemService';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
}

async function start() {
    const service = await ProblemService.open();
    const server = createApp(createProblemRouter(service)).listen(port, '127.0.0.1', () => {
        console.log(`JustCode backend running on http://localhost:${port}`);
    });
    server.once('error', error => {
        service.practice.close();
        console.error('Cannot start backend:', error.message);
        process.exitCode = 1;
    });
    const shutdown = () => {
        process.removeListener('SIGINT', shutdown);
        process.removeListener('SIGTERM', shutdown);
        server.close();
        // A disconnected client can leave a judge running after the HTTP server closes.
        process.once('beforeExit', () => service.practice.close());
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}

void start().catch(error => {
    console.error('Cannot initialize JustCode:', error.message);
    process.exitCode = 1;
});
