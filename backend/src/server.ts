import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
}

// Bind to loopback because this local judge has no authentication.
createApp().listen(port, '127.0.0.1', () => {
    console.log(`JustCode backend running on http://localhost:${port}`);
    console.log(`API endpoints available at http://localhost:${port}/api`);
});
