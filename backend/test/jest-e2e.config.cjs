// Reutiliza la transformación TS y ejecuta únicamente escenarios HTTP e2e.
const baseConfig = require('../jest.config.cjs');

module.exports = {
  ...baseConfig,
  rootDir: '..',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  collectCoverage: false,
};
