import { accessSync, constants, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type Database from 'better-sqlite3';
import type { DataSourceOptions } from 'typeorm';

import type { EnvironmentConfiguration } from '../config/environment.js';
import { domainEntities } from './entity-registry.js';

// Resuelve rutas locales, crea el directorio y comprueba acceso antes de conectar.
function prepareDatabasePath(configuration: EnvironmentConfiguration): string {
  if (configuration.SQLITE_PATH === ':memory:') {
    if (configuration.NODE_ENV !== 'test') {
      throw new Error('In-memory SQLite is restricted to isolated tests.');
    }

    return ':memory:';
  }

  const databasePath = resolve(configuration.SQLITE_PATH);

  try {
    mkdirSync(dirname(databasePath), { recursive: true });
    accessSync(dirname(databasePath), constants.W_OK);

    if (existsSync(databasePath)) {
      accessSync(databasePath, constants.R_OK | constants.W_OK);
    }
  } catch {
    throw new Error('SQLITE_PATH must point to a readable and writable database location.');
  }

  return databasePath;
}

// Comparte opciones entre el servidor, las migraciones y las pruebas de persistencia.
export function createDatabaseOptions(
  configuration: EnvironmentConfiguration,
  migrations: DataSourceOptions['migrations'] = [],
  synchronize = configuration.SQLITE_SYNCHRONIZE,
): DataSourceOptions {
  return {
    type: 'better-sqlite3',
    database: prepareDatabasePath(configuration),
    entities: domainEntities,
    migrations,
    migrationsRun: false,
    synchronize,
    logging: false,
    // Las restricciones FK deben estar activas en todas las conexiones.
    prepareDatabase: (database: Database.Database): void => {
      database.pragma('foreign_keys = ON');
      database.pragma('busy_timeout = 5000');
    },
  };
}
