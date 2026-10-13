// Reutiliza la transformación TS y ejecuta únicamente escenarios HTTP e2e.
const baseConfig = require('../jest.config.cjs');

module.exports = {
  ...baseConfig,
  rootDir: '..',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  testTimeout: 30_000,
  // Los e2e ejercitan controladores, guards, servicios y SQLite: miden la aplicación completa.
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts', // arranque del servidor
    '!src/seed/main.ts', // arranque del seed por CLI
    '!src/database/data-source.ts', // entrada de la CLI de TypeORM
    '!src/database/migrations/**',
    '!src/**/*.interface.ts', // solo tipos, sin código en ejecución
    '!src/**/*-response.dto.ts', // clases usadas solo para documentar OpenAPI
  ],
  coverageDirectory: 'coverage/e2e',
  coverageThreshold: {
    global: { statements: 90, branches: 70, functions: 90, lines: 90 },
    // Las reglas de negocio y autorización deben quedar casi completamente cubiertas.
    './src/**/*.service.ts': { statements: 90, lines: 90 },
  },
};
