import { defineConfig } from 'eslint/config';
import pluginVue from 'eslint-plugin-vue';
import typescriptEslint from 'typescript-eslint';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';

export default defineConfig(
  {
    name: 'app/files-to-ignore',
    ignores: ['dist/**', 'node_modules/**'],
  },
  // Keep the previous recommended rules on TS, Vue and configuration files.
  ...typescriptEslint.configs.recommended.map((config) =>
    config.files ? { ...config, files: [...config.files, '**/*.vue'] } : config,
  ),
  ...pluginVue.configs['flat/essential'],
  {
    name: 'app/vue-typescript-parser',
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: typescriptEslint.parser,
        ecmaVersion: 2024,
        extraFileExtensions: ['.vue'],
      },
    },
    // Preserve the previous wrapper's requirement for TypeScript in every SFC script.
    rules: {
      'vue/block-lang': ['error', { script: { lang: ['ts'], allowNoLang: false } }],
    },
  },
  skipFormatting,
);
