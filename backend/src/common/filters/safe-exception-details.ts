import { HttpException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { getSqliteErrorCode } from '../../database/sqlite-error-code.js';

interface SafeExceptionDetails {
  type: string;
  code: string | undefined;
  locations: string[];
}

// Los mensajes y parámetros de TypeORM pueden contener SQL y datos privados.
// Solo publica categorías conocidas y ubicaciones del código, sin la primera línea del stack.
export function getSafeExceptionDetails(exception: unknown): SafeExceptionDetails {
  const type =
    exception instanceof QueryFailedError
      ? 'QueryFailedError'
      : exception instanceof HttpException
        ? 'HttpException'
        : exception instanceof TypeError
          ? 'TypeError'
          : exception instanceof RangeError
            ? 'RangeError'
            : exception instanceof Error
              ? 'Error'
              : 'UnknownError';
  const sqliteCode = getSqliteErrorCode(exception);
  const safeCodes = [
    'SQLITE_ERROR',
    'SQLITE_BUSY',
    'SQLITE_LOCKED',
    'SQLITE_READONLY',
    'SQLITE_IOERR',
    'SQLITE_CORRUPT',
    'SQLITE_FULL',
    'SQLITE_CANTOPEN',
    'SQLITE_CONSTRAINT_CHECK',
    'SQLITE_CONSTRAINT_FOREIGNKEY',
    'SQLITE_CONSTRAINT_NOTNULL',
    'SQLITE_CONSTRAINT_PRIMARYKEY',
    'SQLITE_CONSTRAINT_UNIQUE',
  ];
  const code = sqliteCode && safeCodes.includes(sqliteCode) ? sqliteCode : undefined;
  const locations: string[] = [];

  // No registra nombres de funciones, rutas absolutas, mensajes ni stacks completos.
  if (exception instanceof Error && typeof exception.stack === 'string') {
    for (const frame of exception.stack.split('\n').slice(1)) {
      const location = frame.match(/\/(src|dist)\/([a-zA-Z0-9_./-]+\.[jt]s):([0-9]+):([0-9]+)\)?$/);
      if (location) locations.push(`${location[1]}/${location[2]}:${location[3]}:${location[4]}`);
      if (locations.length === 5) break;
    }
  }

  return { type, code, locations };
}
