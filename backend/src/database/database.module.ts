import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import type { EnvironmentConfiguration } from '../config/environment.js';
import { createDatabaseOptions } from './database-options.js';
import { initializeDatabase } from './initialize-database.js';
import { DatabaseWriteService } from './database-write.service.js';

// Abre SQLite con configuración validada y registra exactamente las cuatro entidades.
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configuration: ConfigService<EnvironmentConfiguration, true>) =>
        createDatabaseOptions({
          NODE_ENV: configuration.get('NODE_ENV', { infer: true }),
          PORT: configuration.get('PORT', { infer: true }),
          CORS_ORIGIN: configuration.get('CORS_ORIGIN', { infer: true }),
          JWT_SECRET: configuration.get('JWT_SECRET', { infer: true }),
          JWT_EXPIRES_IN: configuration.get('JWT_EXPIRES_IN', { infer: true }),
          SQLITE_PATH: configuration.get('SQLITE_PATH', { infer: true }),
          SQLITE_SYNCHRONIZE: configuration.get('SQLITE_SYNCHRONIZE', { infer: true }),
        }),
      dataSourceFactory: async (options) => {
        if (options === undefined) {
          throw new Error('Database options are required.');
        }

        return initializeDatabase(options);
      },
    }),
  ],
  providers: [DatabaseWriteService],
  exports: [DatabaseWriteService],
})
export class DatabaseModule {}
