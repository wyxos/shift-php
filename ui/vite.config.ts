import vue from '@vitejs/plugin-vue';
import path from 'path';
import { defineConfig } from 'vite';
import fs from 'fs'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({command}) => ({
    plugins: [
        vue(),
        tailwindcss()
    ],
    base: command === 'serve' ? '/' : '/shift/',
    build: {
        outDir: path.resolve(__dirname, '../public/shift'), // Outputs to ../public/shift
        assetsDir: 'assets', // This makes assets output to ../public/shift/assets
        emptyOutDir: true, // Cleans output directory before build
    },
    server: {
        host: 'shift-sdk-package.test',
        port: 5174,
        strictPort: true,
        hmr: {
            host: 'shift-sdk-package.test'
        },
        https: {
            key: fs.readFileSync('C:\\Users\\joeyj\\.config\\herd\\config\\valet\\Certificates\\shift-sdk-package.test.key'),
            cert: fs.readFileSync('C:\\Users\\joeyj\\.config\\herd\\config\\valet\\Certificates\\shift-sdk-package.test.crt'),
        },
        cors: true,
        proxy: {
            // Proxy API requests to the Laravel backend
            '/shift/api': {
                target: 'https://shift-sdk-package.test',
                changeOrigin: true,
                secure: false
            }
        }
    }
}));
