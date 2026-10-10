import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

// Registra una línea por petición al terminar, incluidos 401, 404 y errores de validación.
// Solo usa método, ruta sin query, estado y duración: nunca headers, cuerpo ni tokens.
export function requestLogger(request: Request, response: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  response.on('finish', () => {
    logger.log({
      event: 'http_request',
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
    });
  });
  next();
}
