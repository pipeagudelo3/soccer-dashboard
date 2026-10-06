import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import type { AuthenticatedUserInterface } from '../auth/interfaces/authenticated-user.interface.js';
import { DatabaseWriteService } from '../database/database-write.service.js';
import { getSqliteErrorCode } from '../database/sqlite-error-code.js';
import type { CreateUserDTO } from './dto/create-user.dto.js';
import type { UpdateUserDTO } from './dto/update-user.dto.js';
import type { UserResponseDTO } from './dto/user-response.dto.js';
import { User } from './entities/user.entity.js';
import { PasswordService } from './password.service.js';

// El servicio concentra reglas y transacciones; los controllers solo delegan HTTP.
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    private readonly databaseWriteService: DatabaseWriteService,
    private readonly passwordService: PasswordService,
  ) {}

  async findAll(): Promise<UserResponseDTO[]> {
    // Sin paginación según #39; dos columnas proporcionan un orden estable.
    const users = await this.usersRepository.find({ order: { createdAt: 'ASC', id: 'ASC' } });
    return users.map((user) => user.toJSON());
  }

  async findOne(id: string): Promise<UserResponseDTO> {
    return (await this.requireUser(this.usersRepository, id)).toJSON();
  }

  async create(dto: CreateUserDTO, actor: AuthenticatedUserInterface): Promise<UserResponseDTO> {
    // El trabajo bcrypt ocurre antes de abrir la transacción para reducir bloqueos.
    const passwordHash = await this.passwordService.hashPassword(dto.password);
    return this.write(actor, async (repository) => {
      const email = dto.email.trim().toLowerCase();
      await this.ensureUniqueEmail(repository, email);
      const user = repository.create({ name: dto.name, email, role: dto.role, passwordHash });
      return (await repository.save(user)).toJSON();
    });
  }

  async update(
    id: string,
    dto: UpdateUserDTO,
    actor: AuthenticatedUserInterface,
  ): Promise<UserResponseDTO> {
    // Un PATCH vacío no representa una modificación. Omitir password conserva su hash.
    if ([dto.name, dto.email, dto.password, dto.role].every((value) => value === undefined)) {
      throw new BadRequestException('Provide at least one editable user field.');
    }
    const passwordHash =
      dto.password === undefined
        ? undefined
        : await this.passwordService.hashPassword(dto.password);

    return this.write(actor, async (repository) => {
      const user = await this.requireUser(repository, id);
      if (user.role === 'admin' && dto.role === 'user') {
        await this.protectLastAdministrator(repository);
      }
      if (dto.email !== undefined) {
        const email = dto.email.trim().toLowerCase();
        await this.ensureUniqueEmail(repository, email, id);
        user.email = email;
      }
      if (dto.name !== undefined) user.name = dto.name;
      if (dto.role !== undefined) user.role = dto.role;
      if (passwordHash !== undefined) user.passwordHash = passwordHash;

      // Puede editarse a sí mismo, incluso degradarse si queda otro admin.
      // La respuesta contiene su perfil actualizado; el siguiente guard relee su rol.
      return (await repository.save(user)).toJSON();
    });
  }

  async remove(id: string, actor: AuthenticatedUserInterface): Promise<void> {
    await this.write(actor, async (repository) => {
      const user = await this.requireUser(repository, id);
      if (user.role === 'admin') await this.protectLastAdministrator(repository);
      // La autoeliminación está permitida si queda otro admin. No cambia el contrato
      // 204; el frontend compara IDs, cierra su sesión y futuros requests reciben 401.
      await repository.remove(user);
    });
  }

  private async requireUser(repository: Repository<User>, id: string): Promise<User> {
    const user = await repository.findOneBy({ id });
    if (user === null) throw new NotFoundException('User not found.');
    return user;
  }

  private async ensureUniqueEmail(
    repository: Repository<User>,
    email: string,
    currentId?: string,
  ): Promise<void> {
    const existing = await repository.findOneBy({ email });
    if (existing !== null && existing.id !== currentId) {
      throw new ConflictException('A user with this email already exists.');
    }
  }

  private async protectLastAdministrator(repository: Repository<User>): Promise<void> {
    // Cuenta y modificación comparten transacción; SQLite impide escrituras
    // concurrentes desde otra conexión basadas en una lectura ya desactualizada.
    if ((await repository.countBy({ role: 'admin' })) <= 1) {
      throw new ConflictException('The last administrator cannot be demoted or deleted.');
    }
  }

  private write<T>(
    actor: AuthenticatedUserInterface,
    operation: (repository: Repository<User>) => Promise<T>,
  ): Promise<T> {
    // Comparte la cola de SQLite con Teams para evitar transacciones superpuestas.
    return this.databaseWriteService
      .runAsAdministrator(actor, (manager) => operation(manager.getRepository(User)))
      .catch((error: unknown) => {
        if (getSqliteErrorCode(error) === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new ConflictException('A user with this email already exists.');
        }
        throw error;
      });
  }
}
