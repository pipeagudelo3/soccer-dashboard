import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';

import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import type { EnvironmentConfiguration } from './config/environment.js';

// Permite reutilizar en e2e exactamente la misma inicialización que en producción.
export async function createApplication(): Promise<INestApplication> {
  const application = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  const configuration = application.get(ConfigService<EnvironmentConfiguration, true>);

  // Mantiene la API bajo /api y restringe CORS a los orígenes validados.
  application.setGlobalPrefix('api');
  // Rechaza campos desconocidos y valida DTOs sin conversiones implícitas de tipos.
  application.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      validationError: { target: false, value: false },
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  application.useGlobalFilters(new ApiExceptionFilter());
  application.enableCors({
    origin: configuration.get('CORS_ORIGIN', { infer: true }),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  // Cierra conexiones cuando el proceso recibe señales de apagado.
  application.enableShutdownHooks();

  return application;
}
