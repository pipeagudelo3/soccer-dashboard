import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Excluye artefactos generados y aplica reglas con análisis de tipos al código TS.
export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parserOptions: {
        project: './tsconfig.test.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
    },
  },
  // Los archivos de herramientas son JavaScript y usan globals de Node.
  {
    files: ['*.mjs', '*.cjs', 'test/*.cjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  // Prettier resuelve el formato sin reglas de ESLint que compitan con él.
  prettier,
);
