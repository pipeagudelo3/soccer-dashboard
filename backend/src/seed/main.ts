import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';

import { validateEnvironment } from '../config/environment.js';
import { resolveSeedPath } from './seed-options.js';
import { SeedService } from './seed.service.js';

// npm run seed carga .env con los flags de Node, sin abrir un servidor HTTP.
async function runSeedCommand(): Promise<void> {
  const configuration = validateEnvironment(process.env);
  const argumentsList = process.argv.slice(2);
  const selectedPath = resolveSeedPath(configuration, argumentsList);

  // Configura una base nueva antes de que ConfigModule lea el entorno del contexto Nest.
  process.env.SQLITE_PATH = selectedPath;
  if (argumentsList.includes('--clean')) {
    process.env.SQLITE_SYNCHRONIZE = 'true';
  }

  const { SeedModule } = await import('./seed.module.js');
  let application: INestApplicationContext | undefined;

  try {
    application = await NestFactory.createApplicationContext(SeedModule, {
      logger: false,
      abortOnError: false,
    });
    const result = await application.get(SeedService).run();
    console.info(`Seed completed: ${JSON.stringify(result)}`);
    console.info(`SQLITE_PATH=${selectedPath}`);

    // El comando clean no cambia .env: el usuario elige si utilizar la nueva base.
    if (argumentsList.includes('--clean')) {
      console.info(
        'To use this new database, copy the displayed SQLITE_PATH into your local env file.',
      );
    }
  } finally {
    await application?.close();
  }
}

// Reporta fallos sin volcar consultas, passwords ni hashes, y permite detectar la salida fallida.
try {
  await runSeedCommand();
} catch {
  console.error('Seed command failed. Check local configuration, database schema and connection.');
  process.exitCode = 1;
}
