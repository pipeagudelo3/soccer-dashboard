import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { DataSource, EntityManager, Repository } from 'typeorm';

import type { AuthenticatedUserInterface } from '../auth/interfaces/authenticated-user.interface.js';
import { DatabaseWriteService } from '../database/database-write.service.js';
import { User } from './entities/user.entity.js';
import { PasswordService } from './password.service.js';
import { UsersService } from './users.service.js';

// Aísla las reglas del servicio con colaboradores tipados, sin abrir SQLite ni HTTP.
describe('UsersService', () => {
  const actor: AuthenticatedUserInterface = { id: 'actor', role: 'admin' };
  const dto = {
    name: 'New User',
    email: ' NEW@SOCCER.EXAMPLE ',
    password: 'NewPassword123',
    role: 'user' as const,
  };
  const findOneBy = jest.fn<(criteria: { id?: string; email?: string }) => Promise<User | null>>();
  const find = jest.fn<() => Promise<User[]>>();
  const countBy = jest.fn<() => Promise<number>>();
  const save = jest.fn<(user: User) => Promise<User>>();
  const remove = jest.fn<(user: User) => Promise<User>>();
  const hashPassword = jest.fn<(password: string) => Promise<string>>();
  const repository = {
    findOneBy,
    find,
    countBy,
    save,
    remove,
    create: (fields: Partial<User>): User =>
      Object.assign(
        new User(),
        {
          id: 'new-user',
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
        },
        fields,
      ),
  } as unknown as Repository<User>;
  const manager = { getRepository: () => repository } as unknown as EntityManager;
  const dataSource = {
    transaction: <T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> =>
      operation(manager),
  } as unknown as DataSource;
  let service: UsersService;

  function user(id = 'target', role: 'admin' | 'user' = 'user'): User {
    return repository.create({
      id,
      name: 'Existing User',
      email: `${id}@soccer.example`,
      role,
      passwordHash: 'private-hash',
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    findOneBy.mockImplementation(({ id }) =>
      Promise.resolve(id === actor.id ? user(actor.id, 'admin') : null),
    );
    find.mockResolvedValue([]);
    countBy.mockResolvedValue(2);
    save.mockImplementation((value) => Promise.resolve(value));
    remove.mockImplementation((value) => Promise.resolve(value));
    hashPassword.mockResolvedValue('new-private-hash');
    const passwords = Object.assign(new PasswordService(), { hashPassword });
    service = new UsersService(repository, new DatabaseWriteService(dataSource), passwords);
  });

  // Incluso una entidad con hash seleccionado debe pasar por el mapper público.
  it('maps lists without secrets and preserves the stable ordering contract', async () => {
    find.mockResolvedValue([user()]);
    expect(await service.findAll()).toEqual([user().toJSON()]);
    expect(find).toHaveBeenCalledWith({ order: { createdAt: 'ASC', id: 'ASC' } });
    expect(JSON.stringify(await service.findAll())).not.toContain('private-hash');
  });

  it('returns 404 when an ID does not exist', async () => {
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('persists a normalized email and the hash, never the plaintext password', async () => {
    await service.create(dto, actor);
    expect(hashPassword).toHaveBeenCalledWith(dto.password);
    const saved = save.mock.calls[0]?.[0];
    expect(saved).toMatchObject({ email: 'new@soccer.example', passwordHash: 'new-private-hash' });
    expect(saved).not.toHaveProperty('password');
  });

  it('rejects duplicates before saving', async () => {
    findOneBy.mockImplementation(({ id, email }) =>
      Promise.resolve(id === actor.id ? user(actor.id, 'admin') : email ? user() : null),
    );
    await expect(service.create(dto, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an empty patch without hashing or persisting', async () => {
    await expect(service.update('target', {}, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(hashPassword).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('blocks the last administrator before applying any requested field', async () => {
    const target = user('target', 'admin');
    findOneBy.mockImplementation(({ id }) =>
      Promise.resolve(id === actor.id ? user(actor.id, 'admin') : target),
    );
    countBy.mockResolvedValue(1);
    await expect(
      service.update('target', { role: 'user', name: 'Must Not Change' }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(target.name).toBe('Existing User');
    expect(target.role).toBe('admin');
    expect(save).not.toHaveBeenCalled();
    await expect(service.remove('target', actor)).rejects.toBeInstanceOf(ConflictException);
    expect(remove).not.toHaveBeenCalled();
  });

  it('rechecks an actor deleted after the HTTP guard', async () => {
    findOneBy.mockResolvedValue(null);
    await expect(service.remove('target', actor)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(remove).not.toHaveBeenCalled();
  });

  it('rechecks an actor demoted after the HTTP guard', async () => {
    findOneBy.mockResolvedValue(user(actor.id, 'user'));
    await expect(service.remove('target', actor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(remove).not.toHaveBeenCalled();
  });

  // Traduce restricciones concurrentes sin publicar SQL ni dejar la cola bloqueada.
  it.each([
    ['SQLITE_CONSTRAINT_UNIQUE', ConflictException],
    ['SQLITE_BUSY', ServiceUnavailableException],
    ['SQLITE_BUSY_SNAPSHOT', ServiceUnavailableException],
  ])('translates %s and allows the next write to proceed', async (code, ExceptionClass) => {
    save.mockRejectedValueOnce(
      new QueryFailedError(
        'private SQL',
        [],
        Object.assign(new Error('private details'), { code }),
      ),
    );
    await expect(service.create(dto, actor)).rejects.toBeInstanceOf(ExceptionClass);
    await expect(service.create(dto, actor)).resolves.toMatchObject({
      email: 'new@soccer.example',
    });
  });

  it('propagates unexpected database errors for the global safe error filter', async () => {
    const failure = new Error('Unexpected private details');
    save.mockRejectedValueOnce(failure);
    await expect(service.create(dto, actor)).rejects.toBe(failure);
  });
});
