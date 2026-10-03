// Jest ejecuta TypeScript como ESM para mantener compatibilidad con NestJS 12.
// La transformación conserva decoradores y sus metadatos; el build usa NodeNext.
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  coverageProvider: 'v8',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json', useESM: true }],
  },
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  clearMocks: true,
  collectCoverageFrom: ['src/config/environment.ts', 'src/health/health.service.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: { branches: 85, functions: 100, lines: 95, statements: 95 },
  },
};
