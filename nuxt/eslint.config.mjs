import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt({
  files: ['app/**/*.{ts,vue}', 'server/**/*.ts', 'shared/**/*.ts'],
  rules: {
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    // Course convention: stateless services/utilities are classes with static methods.
    '@typescript-eslint/no-extraneous-class': ['error', { allowStaticOnly: true }],
    // Match Prettier's Vue output instead of maintaining two conflicting formatters.
    'vue/html-self-closing': ['error', { html: { void: 'always' } }],
    'sort-imports': ['error', { ignoreDeclarationSort: true }],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['./*', '../*', '@/*'],
            message: 'Use ~/, ~~/server/ or #shared/ consistently.',
          },
        ],
      },
    ],
    'no-restricted-syntax': [
      'error',
      { selector: 'ImportExpression', message: 'Use static imports for application modules.' },
    ],
  },
});
