import { Catch, HttpException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

import type { ApiErrorResponseDTO } from '../dto/api-error-response.dto.js';

// Unifica fallos de guards, pipes y services; los inesperados reciben mensaje genérico.
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    let messages = ['Internal server error.'];

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
