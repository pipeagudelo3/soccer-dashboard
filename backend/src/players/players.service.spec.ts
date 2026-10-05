import { jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { DataSource, EntityManager, Repository } from 'typeorm';

import type { AuthenticatedUserInterface } from '../auth/interfaces/authenticated-user.interface.js';
import { DatabaseWriteService } from '../database/database-write.service.js';
import { Team } from '../teams/entities/team.entity.js';
import { User } from '../users/entities/user.entity.js';
import type { CreatePlayerDTO } from './dto/create-player.dto.js';
import { Player } from './entities/player.entity.js';
import { PlayersService } from './players.service.js';

// Aísla reglas del servicio; HTTP, rollback y relaciones reales se verifican en e2e.
describe('PlayersService', () => {
  const actor: AuthenticatedUserInterface = { id: 'admin', role: 'admin' };
  const teamId = '20000000-0000-4000-8000-000000000001';
  const fields: CreatePlayerDTO = {
    name: 'Demo Player',
    position: 'Forward',
    status: 'active',
    teamId,
    goals: 3,
    assists: 2,
  };
  const find = jest.fn<() => Promise<Player[]>>();
  const findOneBy = jest.fn<() => Promise<Player | null>>();
  const save = jest.fn<(player: Player) => Promise<Player>>();
  const remove = jest.fn<(player: Player) => Promise<Player>>();
  const existsBy = jest.fn<(criteria: { id: string }) => Promise<boolean>>();
  const repository = {
    find,
    findOneBy,
    save,
    remove,
    create: (values: Partial<Player>): Player =>
      Object.assign(
        new Player(),
        {
          ...fields,
          id: 'player',
          createdAt: new Date('2020-01-01'),
          updatedAt: new Date('2020-01-01'),
        },
        values,
      ),
  } as unknown as Repository<Player>;
  const manager = {
    getRepository: (entity: unknown): unknown => {
      if (entity === Player) return repository;
      if (entity === Team) return { existsBy };
      if (entity === User) return { findOneBy: () => Promise.resolve(actor) };
      throw new Error('Unexpected repository');
    },
  } as unknown as EntityManager;
  const dataSource = {
    transaction: <T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> =>
      operation(manager),
  } as unknown as DataSource;
  let service: PlayersService;

  beforeEach(() => {
    jest.clearAllMocks();
    find.mockResolvedValue([]);
    findOneBy.mockResolvedValue(repository.create(fields));
    save.mockImplementation((player) => Promise.resolve(player));
    remove.mockImplementation((player) => Promise.resolve(player));
    existsBy.mockResolvedValue(true);
    service = new PlayersService(repository, new DatabaseWriteService(dataSource));
  });

  it('returns nine fields even when an ORM team has been loaded', async () => {
    const player = repository.create(fields);
    player.team = Object.assign(new Team(), { id: teamId });
    find.mockResolvedValue([player]);
    const result = await service.findAll();
    expect(Object.keys(result[0] ?? {})).toHaveLength(9);
    expect(result[0]).not.toHaveProperty('team');
    expect(result[0]?.createdAt).toBe('2020-01-01T00:00:00.000Z');
  });

  it('trims text and checks the team before saving', async () => {
    await service.create(
      {
        ...fields,
        name: ' Demo Player ',
        position: ' Forward ',
        status: ' active ' as Player['status'],
      },
      actor,
    );
    expect(save.mock.calls[0]?.[0]).toMatchObject(fields);
    expect(existsBy).toHaveBeenCalledWith({ id: teamId });
  });

  it('accepts null teamId without consulting teams', async () => {
    await expect(service.create({ ...fields, teamId: null }, actor)).resolves.toMatchObject({
      teamId: null,
    });
    expect(existsBy).not.toHaveBeenCalled();
  });

  it('rejects missing teamId on create rather than defaulting to null', async () => {
    const { teamId: omittedTeamId, ...incomplete } = fields;
    expect(omittedTeamId).toBe(teamId);
    await expect(service.create(incomplete as CreatePlayerDTO, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it.each(['goals', 'assists'] as const)(
    'rejects non-finite and unsafe %s before persistence',
    async (field) => {
      for (const value of [NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
        await expect(service.create({ ...fields, [field]: value }, actor)).rejects.toBeInstanceOf(
          BadRequestException,
        );
      }
      expect(save).not.toHaveBeenCalled();
    },
  );

  it('does not mutate an existing player when a replacement team is unknown', async () => {
    const player = repository.create(fields);
    findOneBy.mockResolvedValue(player);
    existsBy.mockResolvedValue(false);
    await expect(service.update(player.id, { teamId, goals: 99 }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(player.goals).toBe(3);
    expect(save).not.toHaveBeenCalled();
  });

  it('preserves the team on omission but applies explicit null and zero', async () => {
    await expect(service.update('player', { goals: 0 }, actor)).resolves.toMatchObject({
      teamId,
      goals: 0,
      assists: 2,
    });
    await expect(service.update('player', { teamId: null }, actor)).resolves.toMatchObject({
      teamId: null,
    });
  });

  it('validates the resulting record before saving a partial update', async () => {
    findOneBy.mockResolvedValue(repository.create({ goals: -1 }));
    await expect(
      service.update('player', { position: 'Midfielder' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an empty update', async () => {
    await expect(service.update('player', {}, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(save).not.toHaveBeenCalled();
  });

  it('returns 404 for each operation on a missing player', async () => {
    findOneBy.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update('missing', { goals: 0 }, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.remove('missing', actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(remove).not.toHaveBeenCalled();
  });

  it('translates a late foreign-key failure into a safe domain error', async () => {
    save.mockRejectedValueOnce(
      new QueryFailedError(
        'private SQL',
        [],
        Object.assign(new Error('private details'), { code: 'SQLITE_CONSTRAINT_FOREIGNKEY' }),
      ),
    );
    await expect(service.create(fields, actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('preserves unexpected failures for the global exception filter', async () => {
    const error = new Error('unexpected failure');
    save.mockRejectedValueOnce(error);
    await expect(service.create(fields, actor)).rejects.toBe(error);
  });
});
