import { getJwtExpirationSeconds, validateEnvironment } from './environment.js';

// Credencial ficticia y exclusiva de pruebas; nunca se usa para iniciar el servidor real.
const testEnvironment: Record<string, unknown> = {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-only-secret-with-at-least-32-bytes',
};

// Verifica defaults, tipos y rechazo temprano de configuraciones inseguras o inválidas.
describe('validateEnvironment', () => {
  it('normalizes local configuration with typed defaults', () => {
    expect(validateEnvironment(testEnvironment)).toEqual({
      NODE_ENV: 'test',
      PORT: 3000,
      CORS_ORIGIN: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      JWT_SECRET: testEnvironment.JWT_SECRET,
      JWT_EXPIRES_IN: '15m',
      SQLITE_PATH: './data/database.sqlite',
      SQLITE_SYNCHRONIZE: true,
    });
  });

  it('uses development as the default environment', () => {
    expect(validateEnvironment({ JWT_SECRET: testEnvironment.JWT_SECRET }).NODE_ENV).toBe(
      'development',
    );
  });

  it('accepts explicit production configuration and deduplicates origins', () => {
    const configuration = validateEnvironment({
      ...testEnvironment,
      NODE_ENV: 'production',
      PORT: '8080',
      CORS_ORIGIN: 'https://soccer.example.com, https://soccer.example.com',
      JWT_EXPIRES_IN: '1h',
      SQLITE_PATH: '/data/database.sqlite',
    });

    expect(configuration.SQLITE_SYNCHRONIZE).toBe(false);
    expect(configuration.PORT).toBe(8080);
    expect(configuration.CORS_ORIGIN).toEqual(['https://soccer.example.com']);
    expect(configuration.SQLITE_PATH).toBe('/data/database.sqlite');
  });

  it.each([
    ['NODE_ENV', 'invalid'],
    ['PORT', '0'],
    ['PORT', '65536'],
    ['PORT', '3000.5'],
    ['PORT', 'abc'],
    ['PORT', ''],
    ['PORT', 3000],
    ['JWT_SECRET', undefined],
    ['JWT_SECRET', 'short'],
    ['JWT_EXPIRES_IN', '0m'],
    ['JWT_EXPIRES_IN', 'invalid'],
    ['JWT_EXPIRES_IN', '2h'],
    ['JWT_EXPIRES_IN', '3601s'],
    ['JWT_EXPIRES_IN', '999999999999999999999m'],
    ['SQLITE_PATH', ''],
    ['SQLITE_SYNCHRONIZE', 'invalid'],
    ['CORS_ORIGIN', '*'],
    ['CORS_ORIGIN', 'http://localhost:5173/path'],
    ['CORS_ORIGIN', 'ftp://soccer.example.com'],
    ['CORS_ORIGIN', 'http://localhost:5173,'],
  ])('rejects invalid %s configuration (%s)', (name, value) => {
    expect(() => validateEnvironment({ ...testEnvironment, [name]: value })).toThrow(name);
  });

  it('rejects automatic schema synchronization in production', () => {
    expect(() =>
      validateEnvironment({
        ...testEnvironment,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'https://soccer.example.com',
        SQLITE_SYNCHRONIZE: 'true',
      }),
    ).toThrow('SQLITE_SYNCHRONIZE');
  });

  it('requires explicit CORS configuration in production', () => {
    expect(() => validateEnvironment({ ...testEnvironment, NODE_ENV: 'production' })).toThrow(
      'CORS_ORIGIN',
    );
  });

  it.each([
    ['1s', 1],
    ['15m', 900],
    ['1h', 3600],
  ])('converts %s into seconds', (value, seconds) => {
    expect(getJwtExpirationSeconds(String(value))).toBe(seconds);
  });
});
