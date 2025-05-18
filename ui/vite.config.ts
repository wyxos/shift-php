import vue from '@vitejs/plugin-vue';
import path from 'path';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
    plugins: [vue()],
    base: '/shift/', // Important: ensures built asset URLs start with /shift/
    build: {
        outDir: path.resolve(__dirname, '../public/shift'), // Outputs to ../public/shift
        assetsDir: 'assets', // This makes assets output to ../public/shift/assets
        emptyOutDir: true, // Cleans output directory before build
    }
});
