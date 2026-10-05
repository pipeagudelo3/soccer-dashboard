// Declara el contrato de configuración que consumirán los módulos del backend.
export interface EnvironmentConfiguration {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  CORS_ORIGIN: string[];
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  SQLITE_PATH: string;
  SQLITE_SYNCHRONIZE: boolean;
}

// Lee texto sin convertir silenciosamente objetos o números inesperados.
function readText(value: unknown, name: string, fallback?: string): string {
  if (value === undefined && fallback !== undefined) {
    return fallback;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return value.trim();
}

// Acepta exclusivamente orígenes HTTP/HTTPS exactos, sin paths ni wildcard.
function parseCorsOrigins(value: string): string[] {
  const origins = value.split(',').map((origin) => origin.trim());

  for (const origin of origins) {
    let parsedOrigin: URL;

    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error('CORS_ORIGIN must contain valid HTTP or HTTPS origins.');
    }

    if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin) {
      throw new Error('CORS_ORIGIN must contain exact HTTP or HTTPS origins without paths.');
    }
  }

  return [...new Set(origins)];
}

// Valida toda la configuración antes de que Nest abra el puerto del servidor.
// Convierte la duración a segundos y limita el access token académico a una hora.
export function getJwtExpirationSeconds(value: string): number {
  const match = /^([1-9]\d*)([smh])$/.exec(value);
  const unit = match?.[2];
  const duration = Number(match?.[1]) * (unit === 'h' ? 3600 : unit === 'm' ? 60 : 1);
  if (!match || !Number.isSafeInteger(duration) || duration < 1 || duration > 3600) {
    throw new Error('JWT_EXPIRES_IN must be a positive duration between 1s and 1h.');
  }
  return duration;
}

// Los errores nombran la variable, pero nunca imprimen su valor ni el secreto.
export function validateEnvironment(
  environment: Record<string, unknown>,
): EnvironmentConfiguration {
  const nodeEnvironment = readText(environment.NODE_ENV, 'NODE_ENV', 'development');

  if (
    nodeEnvironment !== 'development' &&
    nodeEnvironment !== 'test' &&
    nodeEnvironment !== 'production'
  ) {
    throw new Error('NODE_ENV must be development, test or production.');
  }

  const rawPort = readText(environment.PORT, 'PORT', '3000');
  const port = Number(rawPort);

  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const jwtSecret = readText(environment.JWT_SECRET, 'JWT_SECRET');

  if (Buffer.byteLength(jwtSecret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must contain at least 32 bytes.');
  }

  const jwtExpiresIn = readText(environment.JWT_EXPIRES_IN, 'JWT_EXPIRES_IN', '15m');

  getJwtExpirationSeconds(jwtExpiresIn);

  // Producción requiere una lista explícita; desarrollo y tests tienen defaults locales.
  const localOrigins = 'http://localhost:5173,http://127.0.0.1:5173';
  const corsOrigin = readText(
    environment.CORS_ORIGIN,
    'CORS_ORIGIN',
    nodeEnvironment === 'production' ? undefined : localOrigins,
  );

  // SQLite valida acceso y crea el directorio cuando se inicia la conexión.
  const sqlitePath = readText(environment.SQLITE_PATH, 'SQLITE_PATH', './data/database.sqlite');

  // Solo desarrollo y tests pueden sincronizar; producción exige migraciones.
  const synchronizeValue = readText(
    environment.SQLITE_SYNCHRONIZE,
    'SQLITE_SYNCHRONIZE',
    nodeEnvironment === 'production' ? 'false' : 'true',
  );

  if (synchronizeValue !== 'true' && synchronizeValue !== 'false') {
    throw new Error('SQLITE_SYNCHRONIZE must be true or false.');
  }

  if (nodeEnvironment === 'production' && synchronizeValue === 'true') {
    throw new Error('SQLITE_SYNCHRONIZE must be false in production.');
  }

  return {
    NODE_ENV: nodeEnvironment,
    PORT: port,
    CORS_ORIGIN: parseCorsOrigins(corsOrigin),
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: jwtExpiresIn,
    SQLITE_PATH: sqlitePath,
    SQLITE_SYNCHRONIZE: synchronizeValue === 'true',
  };
}
