import { QueryFailedError } from 'typeorm';

// Extrae únicamente el código seguro necesario para traducir errores, nunca el SQL.
export function getSqliteErrorCode(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined;
  const driverError: unknown = error.driverError;
  if (typeof driverError !== 'object' || driverError === null || !('code' in driverError))
    return undefined;
  return typeof driverError.code === 'string' ? driverError.code : undefined;
}
