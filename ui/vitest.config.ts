import path from 'path'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const portalResourcesPath = process.env.VITE_PORTAL_RESOURCES_PATH
  ? path.resolve(process.env.VITE_PORTAL_RESOURCES_PATH)
  : path.resolve(__dirname, '../../../../shift/resources/js')

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^@\/components\/(.*)$/, replacement: path.resolve(portalResourcesPath, 'components/$1') },
      { find: /^@\/lib\/(.*)$/, replacement: path.resolve(portalResourcesPath, 'lib/$1') },
      { find: /^@\/extensions\/(.*)$/, replacement: path.resolve(portalResourcesPath, 'extensions/$1') },
      { find: /^@\/composables\/(.*)$/, replacement: path.resolve(portalResourcesPath, 'composables/$1') },
      { find: /^@shared\/(.*)$/, replacement: path.resolve(portalResourcesPath, 'shared/$1') },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, './src/$1') },
      { find: /^@shift\/components\/(.*)$/, replacement: path.resolve(portalResourcesPath, 'components/$1') },
      { find: /^@shift\/lib\/(.*)$/, replacement: path.resolve(portalResourcesPath, 'lib/$1') },
      { find: /^@shift\/composables\/(.*)$/, replacement: path.resolve(portalResourcesPath, 'composables/$1') },
      { find: /^@shift\/ui\/(.*)$/, replacement: path.resolve(portalResourcesPath, 'components/ui/$1') },
      { find: /^@shift\/utils$/, replacement: path.resolve(portalResourcesPath, 'lib/utils.ts') },
      { find: /^@tiptap\/(.*)$/, replacement: path.resolve(__dirname, 'node_modules/@tiptap/$1') },
      { find: /^highlight\.js\/(.*)$/, replacement: path.resolve(__dirname, 'node_modules/highlight.js/$1') },
      { find: /^lowlight$/, replacement: path.resolve(__dirname, 'node_modules/lowlight') },
      { find: /^emoji-picker-element$/, replacement: path.resolve(__dirname, 'node_modules/emoji-picker-element') },
      { find: /^lucide-vue-next$/, replacement: path.resolve(__dirname, 'node_modules/lucide-vue-next') },
      { find: /^axios$/, replacement: path.resolve(__dirname, 'node_modules/axios') },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
