import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';

import type { AuthenticatedUserInterface } from '../auth/interfaces/authenticated-user.interface.js';
import { User } from '../users/entities/user.entity.js';
import { getSqliteErrorCode } from './sqlite-error-code.js';

// Una cola compartida evita que los módulos CRUD abran transacciones simultáneas
// sobre la misma conexión SQLite. No sustituye restricciones ni bloqueos de la DB.
@Injectable()
export class DatabaseWriteService {
  private pendingWrite: Promise<void> = Promise.resolve();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  runAsAdministrator<T>(
    actor: AuthenticatedUserInterface,
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const result = this.pendingWrite.then(async () => {
      try {
        return await this.dataSource.transaction(async (manager) => {
          // Revalida permisos dentro de la transacción tras esperar la cola:
          // otra petición pudo eliminar o degradar al actor después del guard.
          const currentActor = await manager.getRepository(User).findOneBy({ id: actor.id });
          if (currentActor === null)
            throw new UnauthorizedException('The session is invalid or expired.');
          if (currentActor.role !== 'admin')
            throw new ForbiddenException('Administrator access is required.');
          return operation(manager);
        });
      } catch (error: unknown) {
        // Un bloqueo desde otro proceso cancela la transacción sin filtrar SQL.
        const code = getSqliteErrorCode(error);
        if (code === 'SQLITE_BUSY' || code === 'SQLITE_BUSY_SNAPSHOT') {
          throw new ServiceUnavailableException('Service temporarily unavailable.');
        }
        throw error;
      }
    });
    // Un fallo también libera la cola, permitiendo continuar con otras operaciones.
    this.pendingWrite = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
