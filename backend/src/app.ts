import express from 'express';
import cors from 'cors';
import { STATUS_CODES } from 'node:http';
import { parseJson, stringifyJson } from './shared/json';

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function createApp(routes: express.Router): express.Express {
    const app = express();
    app.disable('x-powered-by');

    // This unauthenticated API executes code and writes local files.
    // Check both Host and Origin to reject external sites and DNS rebinding.
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
    // Parse raw JSON with its integer tokens intact; native JSON.parse would
    // round large integers before request validation or execution sees them.
    app.use(express.text({ type: 'application/json', limit: '10mb' }));
    app.use((req, res, next) => {
        res.json = function (body: unknown) {
            if (!this.get('Content-Type')) this.type('application/json');
            return this.send(stringifyJson(body));
        };
        if (typeof req.body === 'string') {
            try {
                const body = req.body.trim();
                if (body && !['{', '['].includes(body[0])) throw new SyntaxError('Expected an object or array');
                req.body = body ? parseJson(body) : {};
            } catch {
                return next(Object.assign(new SyntaxError('Invalid JSON body'), { type: 'entity.parse.failed', status: 400 }));
            }
        }
        next();
    });
    app.use('/api', routes);
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', message: 'JustCode backend is running' });
    });
    app.use((err: Error & { status?: number; statusCode?: number; type?: string }, _req: express.Request,
        res: express.Response, next: express.NextFunction) => {
        if (res.headersSent) return next(err);
        if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
        if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large' });
        const status = err.status ?? err.statusCode;
        if (typeof status === 'number' && Number.isInteger(status) && status >= 400 && status < 500) {
            return res.status(status).json({ error: STATUS_CODES[status] ?? 'Invalid request' });
        }
        console.error('Unhandled error:', err);
        res.status(500).json({ error: 'Internal server error' });
    });
    return app;
}
