import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

import type { EnvironmentConfiguration } from '../config/environment.js';

// Valida el comando antes de abrir la base; las cuentas públicas de demo no se crean en producción.
export function resolveSeedPath(
  configuration: EnvironmentConfiguration,
  argumentsList: string[],
): string {
  if (configuration.NODE_ENV === 'production') {
    throw new Error('Academic seed commands are restricted to local development and tests.');
  }

  if (argumentsList.length === 0) {
    return configuration.SQLITE_PATH;
  }

  if (argumentsList.length !== 1 || argumentsList[0] !== '--clean') {
    throw new Error('Use npm run seed or npm run seed:clean.');
  }

  // Clean crea un archivo nuevo: nunca borra ni vacía la base ya configurada.
  if (configuration.NODE_ENV !== 'development' || configuration.SQLITE_PATH === ':memory:') {
    throw new Error('A clean database requires a local development database path.');
  }

  return join(dirname(resolve(configuration.SQLITE_PATH)), `database.clean-${randomUUID()}.sqlite`);
}
