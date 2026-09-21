/** React 應用程式的 Vite 設定，以及代理到 3000 連接埠後端的本機 API 代理。 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

export default defineConfig({
    plugins: [react()],
    resolve: {
        // Monaco ships a private sanitizer copy; route that exact import to our
        // patched dependency so the runtime uses the same version as npm audit.
        alias: [{
            find: './dompurify/dompurify.js',
            replacement: path.join(path.dirname(require.resolve('dompurify')), 'purify.es.mjs'),
        }],
    },
    server: {
        port: 5173,
        proxy: {
            // 開發時在 Vite 連接埠上仍讓前端程式使用相對 /api URL。
            '/api': {
                target: 'http://127.0.0.1:3000',
                changeOrigin: true,
            },
        },
    },
})
