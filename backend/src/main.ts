import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';

import { createApplication } from './create-application.js';
import type { EnvironmentConfiguration } from './config/environment.js';

// Arranca el servidor únicamente después de validar la configuración.
async function bootstrap(): Promise<void> {
  const application = await createApplication();
  const configuration = application.get(ConfigService<EnvironmentConfiguration, true>);
  const port = configuration.get('PORT', { infer: true });

  await application.listen(port, '0.0.0.0');
  console.info(`Soccer Dashboard API listening on port ${port}.`);
}

// Devuelve salida no exitosa ante un fallo de arranque; nunca imprime variables privadas.
try {
  await bootstrap();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown startup failure.';
  console.error(`Backend startup failed: ${message}`);
  process.exitCode = 1;
}
