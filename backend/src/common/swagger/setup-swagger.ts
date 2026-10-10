import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Publica la documentación en /api/docs (UI) y /api/docs-json (contrato OpenAPI).
export function setupSwagger(application: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Soccer Dashboard API')
    .setDescription(
      'Log in with POST /api/auth/login and send the token as "Authorization: Bearer <token>".',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup('docs', application, SwaggerModule.createDocument(application, config), {
    useGlobalPrefix: true,
    jsonDocumentUrl: 'docs-json',
  });
}
