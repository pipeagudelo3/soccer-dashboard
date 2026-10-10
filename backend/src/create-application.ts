import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import { requestLogger } from './common/logging/request-logger.js';
import { setupSwagger } from './common/swagger/setup-swagger.js';
import type { EnvironmentConfiguration } from './config/environment.js';

// Las peticiones de esta API son JSON pequeños; un cuerpo mayor se rechaza con 413.
const JSON_BODY_LIMIT = '100kb';

// Permite reutilizar en e2e exactamente la misma inicialización que en producción.
export async function createApplication(): Promise<NestExpressApplication> {
  const application = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Una línea JSON por evento; ninguna línea incluye credenciales ni tokens.
    logger: new ConsoleLogger({ json: true, logLevels: ['error', 'warn', 'log'] }),
    abortOnError: false,
  });
  const configuration = application.get(ConfigService<EnvironmentConfiguration, true>);

  // Cabeceras de seguridad HTTP, registro de peticiones y límite del cuerpo JSON.
  application.use(
    helmet({
      // Safari sobre http://localhost rompe Swagger UI si se fuerza https en sus recursos.
      contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null } },
    }),
  );
  application.use(requestLogger);
  application.useBodyParser('json', { limit: JSON_BODY_LIMIT });

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
  // Documenta las rutas ya registradas, con el prefijo /api incluido.
  setupSwagger(application);

  // Cierra conexiones cuando el proceso recibe señales de apagado.
  application.enableShutdownHooks();

  return application;
}
