import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { defineConfig } from 'vite';

let https = {};

let certBasePath = '';

if (process.platform === 'win32') {
    certBasePath = path.join(os.homedir(), '.config', 'herd', 'config', 'valet', 'Certificates');
}

if (process.platform === 'darwin') {
    certBasePath = path.join(os.homedir(), 'Library', 'Application Support', 'Herd', 'config', 'valet', 'Certificates');
}

const certName = 'shift-sdk-package.test';

https = {
    key: fs.readFileSync(path.join(certBasePath, `${certName}.key`), 'utf8'),
    cert: fs.readFileSync(path.join(certBasePath, `${certName}.crt`), 'utf8'),
};

export default defineConfig(({ command }) => ({
    plugins: [vue(), tailwindcss()],
    base: command === 'serve' ? '/' : '/shift-assets/',
    build: {
        outDir: path.resolve(__dirname, '../public/shift-assets'), // Outputs to ../public/shift
        assetsDir: 'assets', // This makes assets output to ../public/shift/assets
        emptyOutDir: true, // Cleans output directory before build
    },
    server: {
        host: 'shift-sdk-package.test',
        port: 5174,
        strictPort: true,
        hmr: {
            host: 'shift-sdk-package.test',
        },
        https: https,
        cors: true,
        proxy: {
            // Proxy API requests to the Laravel backend
            '/shift/api': {
                target: 'https://shift-sdk-package.test',
                changeOrigin: true,
                secure: false,
            },
        },
    },
}));
