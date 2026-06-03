/** Vite config for the React app and local API proxy to the backend on port 3000. */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            // Keep frontend code using relative /api URLs while developing on Vite's port.
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
})
