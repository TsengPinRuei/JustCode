import express from 'express';
import cors from 'cors';
import problemRoutes from './routes/problemRoutes';

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function createApp(routes = problemRoutes): express.Express {
    const app = express();
    app.disable('x-powered-by');

    // 此 API 可執行程式與修改本機檔案；同時檢查 Host 和 Origin，阻擋外站及 DNS rebinding。
    app.use((req, res, next) => {
        if (!localHosts.has((req.hostname ?? '').toLowerCase())) {
            return res.status(403).json({ error: 'Only local requests are allowed' });
        }
        const origin = req.get('origin');
        if (origin) {
            try {
                const url = new URL(origin);
                if (!['http:', 'https:'].includes(url.protocol) ||
                    !localHosts.has(url.hostname) || url.origin !== origin) {
                    return res.status(403).json({ error: 'Origin is not allowed' });
                }
            } catch {
                return res.status(403).json({ error: 'Origin is not allowed' });
            }
        }
        next();
    });
    app.use(cors({ origin: true }));
    app.use(express.json({ limit: '10mb' }));
    app.use('/api', routes);
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', message: 'JustCode backend is running' });
    });
    app.use((err: Error & { status?: number; type?: string }, _req: express.Request,
        res: express.Response, next: express.NextFunction) => {
        if (res.headersSent) return next(err);
        if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
        if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large' });
        console.error('Unhandled error:', err);
        res.status(500).json({ error: 'Internal server error' });
    });
    return app;
}
