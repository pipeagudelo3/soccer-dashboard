import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnvironment } from './environment.js';

// Centraliza la carga de configuración; .env.local tiene prioridad sobre .env.
// Las variables del proceso tienen prioridad sobre ambos archivos.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnvironment,
    }),
  ],
})
export class EnvironmentModule {}
