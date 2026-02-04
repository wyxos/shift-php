import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  const isServe = command === 'serve';

  // Only add HTTPS when valid certs are found (dev only)
  let httpsOptions: { key: string; cert: string } | undefined = undefined;

  if (isServe) {
    let certBasePath = '';

    if (process.platform === 'win32') {
      certBasePath = path.join(os.homedir(), '.config', 'herd', 'config', 'valet', 'Certificates');
    } else if (process.platform === 'darwin') {
      certBasePath = path.join(os.homedir(), 'Library', 'Application Support', 'Herd', 'config', 'valet', 'Certificates');
    }

    const certName = process.env.VITE_CERT_NAME || 'shift-sdk-package.test';
    const keyPath = process.env.VITE_SSL_KEY_PATH || path.join(certBasePath, `${certName}.key`);
    const certPath = process.env.VITE_SSL_CERT_PATH || path.join(certBasePath, `${certName}.crt`);

    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      httpsOptions = {
        key: fs.readFileSync(keyPath, 'utf8'),
        cert: fs.readFileSync(certPath, 'utf8'),
      };
    }
  }

  const config = {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: [
        // Map shift's @/ imports to shift resources (must come before shift-php's @ alias)
        {
          find: /^@\/components\/(.*)$/,
          replacement: path.resolve(__dirname, '../../../resources/js/components/$1'),
        },
        {
          find: /^@\/lib\/(.*)$/,
          replacement: path.resolve(__dirname, '../../../resources/js/lib/$1'),
        },
        {
          find: /^@\/extensions\/(.*)$/,
          replacement: path.resolve(__dirname, '../../../resources/js/extensions/$1'),
        },
        {
          find: /^@\/composables\/(.*)$/,
          replacement: path.resolve(__dirname, '../../../resources/js/composables/$1'),
        },
        {
          find: /^@shared\/(.*)$/,
          replacement: path.resolve(__dirname, '../../shift-shared-ui/src/$1'),
        },
        // Shift-php's own @ alias (for files in shift-php/src)
        {
          find: /^@\/(.*)$/,
          replacement: path.resolve(__dirname, './src/$1'),
        },
        // Shift component aliases
        {
          find: /^@shift\/components\/(.*)$/,
          replacement: path.resolve(__dirname, '../../../resources/js/components/$1'),
        },
        {
          find: /^@shift\/lib\/(.*)$/,
          replacement: path.resolve(__dirname, '../../../resources/js/lib/$1'),
        },
        {
          find: /^@shift\/composables\/(.*)$/,
          replacement: path.resolve(__dirname, '../../../resources/js/composables/$1'),
        },
        {
          find: /^@shift\/ui\/(.*)$/,
          replacement: path.resolve(__dirname, '../../../resources/js/components/ui/$1'),
        },
        {
          find: /^@shift\/utils$/,
          replacement: path.resolve(__dirname, '../../../resources/js/lib/utils.ts'),
        },
        {
          find: /^@tiptap\/(.*)$/,
          replacement: path.resolve(__dirname, 'node_modules/@tiptap/$1'),
        },
        {
          find: /^highlight\.js\/(.*)$/,
          replacement: path.resolve(__dirname, 'node_modules/highlight.js/$1'),
        },
        {
          find: /^lowlight$/,
          replacement: path.resolve(__dirname, 'node_modules/lowlight'),
        },
        {
          find: /^emoji-picker-element$/,
          replacement: path.resolve(__dirname, 'node_modules/emoji-picker-element'),
        },
        {
          find: /^lucide-vue-next$/,
          replacement: path.resolve(__dirname, 'node_modules/lucide-vue-next'),
        },
        {
          find: /^axios$/,
          replacement: path.resolve(__dirname, 'node_modules/axios'),
        },
      ],
    },
    base: isServe ? '/' : '/shift-assets/',
    build: {
      outDir: path.resolve(__dirname, '../public/shift-assets'),
      assetsDir: 'assets',
      emptyOutDir: true,
    },
    server: {
      host: process.env.VITE_DEV_HOST || 'shift-sdk-package.test',
      port: 5174,
      strictPort: true,
      fs: {
        allow: [
          path.resolve(__dirname),
          path.resolve(__dirname, '../../shift-shared-ui'),
          path.resolve(__dirname, '../../../resources'),
        ],
      },
      hmr: {
        host: process.env.VITE_DEV_HOST || 'shift-sdk-package.test',
      },
      cors: true,
      proxy: {
        '/shift/api': {
          target: process.env.VITE_PROXY_TARGET || 'https://shift-sdk-package.test',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };

  // Conditionally attach https only when certs are available to satisfy TS types
  if (httpsOptions) {
    // @ts-expect-error - Vite types accept https options object here
    config.server.https = httpsOptions;
  }

  return config;
});
