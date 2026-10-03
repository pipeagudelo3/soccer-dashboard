import { dirname, resolve } from 'node:path';

import { validateEnvironment } from '../config/environment.js';
import { resolveSeedPath } from './seed-options.js';

// Valida seguridad del comando y separación de la base limpia sin tocar archivos reales.
describe('Seed command options', () => {
  const configuration = validateEnvironment({
    NODE_ENV: 'development',
    JWT_SECRET: 'seed-options-test-secret-at-least-32-bytes',
    SQLITE_PATH: './data/database.sqlite',
  });

  it('uses the configured database for the ordinary seed command', () => {
    expect(resolveSeedPath(configuration, [])).toBe('./data/database.sqlite');
  });

  it('creates a distinct filename for every clean command without replacing the original', () => {
    const first = resolveSeedPath(configuration, ['--clean']);
    const second = resolveSeedPath(configuration, ['--clean']);

    expect(dirname(first)).toBe(dirname(resolve(configuration.SQLITE_PATH)));
    expect(first).toMatch(/database\.clean-[0-9a-f-]+\.sqlite$/);
    expect(first).not.toBe(resolve(configuration.SQLITE_PATH));
    expect(first).not.toBe(second);
  });

  it('rejects production before a database can be opened', () => {
    expect(() => resolveSeedPath({ ...configuration, NODE_ENV: 'production' }, [])).toThrow(
      'restricted',
    );
  });

  it.each([['--reset'], ['--clean', '--reset']])(
    'rejects unsupported arguments',
    (...argumentsList) => {
      expect(() => resolveSeedPath(configuration, argumentsList)).toThrow('npm run seed');
    },
  );

  it('limits clean databases to local development files', () => {
    expect(() => resolveSeedPath({ ...configuration, NODE_ENV: 'test' }, ['--clean'])).toThrow(
      'local development',
    );
    expect(() =>
      resolveSeedPath({ ...configuration, SQLITE_PATH: ':memory:' }, ['--clean']),
    ).toThrow('local development');
  });
});
