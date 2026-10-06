import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';

import { playerTimestampTrigger } from './player-timestamp-trigger.js';

// En local/tests instala el trigger tras crear las tablas; producción usa migraciones.
export async function initializeDatabase(options: DataSourceOptions): Promise<DataSource> {
  const dataSource = new DataSource(options);
  await dataSource.initialize();

  try {
    if (options.synchronize) {
      await dataSource.query(playerTimestampTrigger);
    }

    return dataSource;
  } catch (error: unknown) {
    await dataSource.destroy();
    throw error;
  }
}
