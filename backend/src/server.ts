/**
 * Express server entry point.
 * Configures middleware (CORS, JSON), mounts API routes, and starts listening.
 */
import express from 'express';
import cors from 'cors';
import problemRoutes from './routes/problemRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

// Accept local frontend requests and moderately large code/debug payloads.
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// All problem, execution, import, and progress endpoints live under /api.
app.use('/api', problemRoutes);

// Lightweight endpoint for install scripts or manual checks.
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'JustCode backend is running' });
});

// Final safeguard for unexpected route errors; route handlers still return specific messages when possible.
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start the single local API server used by the Vite proxy during development.
app.listen(PORT, () => {
    console.log(`JustCode backend running on http://localhost:${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api`);
});
