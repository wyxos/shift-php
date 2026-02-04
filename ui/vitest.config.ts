import path from 'path'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^@\/components\/(.*)$/, replacement: path.resolve(__dirname, '../../../resources/js/components/$1') },
      { find: /^@\/lib\/(.*)$/, replacement: path.resolve(__dirname, '../../../resources/js/lib/$1') },
      { find: /^@\/extensions\/(.*)$/, replacement: path.resolve(__dirname, '../../../resources/js/extensions/$1') },
      { find: /^@\/composables\/(.*)$/, replacement: path.resolve(__dirname, '../../../resources/js/composables/$1') },
      { find: /^@shared\/(.*)$/, replacement: path.resolve(__dirname, '../../shift-shared-ui/src/$1') },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, './src/$1') },
      { find: /^@shift\/components\/(.*)$/, replacement: path.resolve(__dirname, '../../../resources/js/components/$1') },
      { find: /^@shift\/lib\/(.*)$/, replacement: path.resolve(__dirname, '../../../resources/js/lib/$1') },
      { find: /^@shift\/composables\/(.*)$/, replacement: path.resolve(__dirname, '../../../resources/js/composables/$1') },
      { find: /^@shift\/ui\/(.*)$/, replacement: path.resolve(__dirname, '../../../resources/js/components/ui/$1') },
      { find: /^@shift\/utils$/, replacement: path.resolve(__dirname, '../../../resources/js/lib/utils.ts') },
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
