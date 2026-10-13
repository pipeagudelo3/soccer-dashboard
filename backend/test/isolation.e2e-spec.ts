import './test-environment.js';

import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { createApplication } from '../src/create-application.js';

// Los e2e nunca deben tocar una base real: usan SQLite en memoria, descartada al cerrar.
describe('Test isolation (e2e)', () => {
  let application: INestApplication;

  beforeAll(async () => {
    application = await createApplication();
    await application.init();
  });

  afterAll(async () => {
    await application.close();
  });

  it('runs against an in-memory SQLite database, never a file or remote database', () => {
    expect(application.get(DataSource).options).toMatchObject({
      type: 'better-sqlite3',
      database: ':memory:',
    });
  });
});
