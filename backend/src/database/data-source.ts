import { DataSource } from 'typeorm';

import { validateEnvironment } from '../config/environment.js';
import { createDatabaseOptions } from './database-options.js';
import { databaseMigrations } from './migration-registry.js';

// El CLI carga .env mediante los flags de Node; nunca sincroniza el esquema al migrar.
const configuration = validateEnvironment(process.env);
export default new DataSource(createDatabaseOptions(configuration, databaseMigrations, false));
