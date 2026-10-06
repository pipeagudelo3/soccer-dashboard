// Inicializa únicamente la configuración necesaria para e2e en un proceso aislado.
// Ningún archivo .env personal ni secreto de producción se lee en estas pruebas.
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.JWT_SECRET = 'e2e-only-secret-with-at-least-32-bytes';
process.env.JWT_EXPIRES_IN = '15m';
process.env.SQLITE_PATH = ':memory:';
process.env.SQLITE_SYNCHRONIZE = 'true';
