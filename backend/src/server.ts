/**
 * Express server 入口。
 * 設定 middleware（CORS、JSON）、掛載 API routes，並開始 listen。
 */
import express from 'express';
import cors from 'cors';
import problemRoutes from './routes/problemRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

// 接受本機前端請求與中等大小的程式碼/除錯 payload。
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 所有題目、執行、匯入與進度 endpoint 都位於 /api。
app.use('/api', problemRoutes);

// 供安裝腳本或手動檢查使用的輕量 endpoint。
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'JustCode backend is running' });
});

// 非預期路由錯誤的最後防線；route handler 仍會盡量回傳具體訊息。
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 啟動開發時 Vite proxy 使用的單一本機 API server。
app.listen(PORT, () => {
    console.log(`JustCode backend running on http://localhost:${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api`);
});
