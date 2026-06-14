/** React 應用程式的 Vite 設定，以及代理到 3000 連接埠後端的本機 API 代理。 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            // 開發時在 Vite 連接埠上仍讓前端程式使用相對 /api URL。
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
})
