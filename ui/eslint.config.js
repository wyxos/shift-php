import prettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';

import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

export default tseslint.config(
  vue.configs['flat/essential'],
  tseslint.configs.recommended.map((config) => ({
    ...config,
    ...(config.files ? { files: [...config.files, '**/*.vue'] } : {}),
  })),
  vue.configs['flat/base'],
  {
    files: ['*.vue', '**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: { js: 'espree', jsx: 'espree', ts: tseslint.parser, tsx: tseslint.parser },
        ecmaVersion: 2024,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    ignores: ['node_modules', 'dist', '../public/shift-assets'],
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines': ['error', { max: 500 }],
    },
  },
  prettier,
);
