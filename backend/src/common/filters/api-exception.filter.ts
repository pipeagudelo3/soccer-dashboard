import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

import type { ApiErrorResponseDTO } from '../dto/api-error-response.dto.js';
import { getSafeExceptionDetails } from './safe-exception-details.js';

// Unifica fallos de guards, pipes y services; los inesperados reciben mensaje genérico.
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    let messages = ['Internal server error.'];

    // Diagnostica el fallo original sin entregar al logger la excepción ni la petición.
    if (statusCode >= 500) {
      this.logger.error({
        event: 'http_server_error',
        statusCode,
        ...getSafeExceptionDetails(exception),
      });
    }

    // Nunca serializa excepciones completas, SQL, cuerpos de solicitud o headers.
    if (exception instanceof HttpException && statusCode < 500) {
      const errorResponse = exception.getResponse();
      const message: unknown =
        typeof errorResponse === 'string'
          ? errorResponse
          : 'message' in errorResponse
            ? errorResponse.message
            : exception.message;
      if (typeof message === 'string') messages = [message];
      else if (
        Array.isArray(message) &&
        message.every((item: unknown) => typeof item === 'string')
      ) {
        messages = message;
      }
    } else if (statusCode === 503) {
      messages = ['Service temporarily unavailable.'];
    }

    const body: ApiErrorResponseDTO = {
      statusCode,
      message: messages,
      // Excluye la query: nunca refleja tokens ni credenciales enviados allí.
      path: request.originalUrl.split('?')[0] ?? request.path,
      timestamp: new Date().toISOString(),
    };
    response.status(statusCode).json(body);
  }
}
