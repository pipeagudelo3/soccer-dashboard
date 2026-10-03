import { jest } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { DataSource, EntityManager, Repository } from 'typeorm';

import type { AuthenticatedUserInterface } from '../auth/interfaces/authenticated-user.interface.js';
import { DatabaseWriteService } from '../database/database-write.service.js';
import { MatchStats } from '../match-stats/entities/match-stats.entity.js';
import { Player } from '../players/entities/player.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Team } from './entities/team.entity.js';
import { TeamsService } from './teams.service.js';

// Aísla reglas y coordinación; el rollback y las FK se verifican en e2e con SQLite real.
describe('TeamsService', () => {
  const actor: AuthenticatedUserInterface = { id: 'admin', role: 'admin' };
  const fields = {
    name: 'Andes FC',
    logoURL: 'https://example.com/logo.svg',
    country: 'Colombia',
    stadium: 'Demo Stadium',
    foundedDate: '2020-02-29',
  };
  const find = jest.fn<() => Promise<Team[]>>();
  const findOneBy = jest.fn<() => Promise<Team | null>>();
  const save = jest.fn<(team: Team) => Promise<Team>>();
  const remove = jest.fn<(team: Team) => Promise<Team>>();
  const existsBy = jest.fn<() => Promise<boolean>>();
  const updatePlayers =
    jest.fn<
      (criteria: { teamId: string }, fields: { teamId: null; updatedAt: Date }) => Promise<unknown>
    >();
  const repository = {
    find,
    findOneBy,
    save,
    remove,
    create: (values: Partial<Team>): Team =>
      Object.assign(
        new Team(),
        {
          ...fields,
          id: 'team',
          createdAt: new Date('2020-01-01'),
          updatedAt: new Date('2020-01-01'),
        },
        values,
      ),
  } as unknown as Repository<Team>;
  const manager = {
    getRepository: (entity: unknown): unknown => {
      if (entity === Team) return repository;
      if (entity === Player) return { update: updatePlayers };
      if (entity === MatchStats) return { existsBy };
      if (entity === User)
        return { findOneBy: () => Promise.resolve({ id: actor.id, role: actor.role }) };
      throw new Error('Unexpected repository');
    },
  } as unknown as EntityManager;
  const dataSource = {
    transaction: <T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> =>
      operation(manager),
  } as unknown as DataSource;
  let service: TeamsService;

  beforeEach(() => {
    jest.clearAllMocks();
    find.mockResolvedValue([]);
    findOneBy.mockResolvedValue(repository.create(fields));
    save.mockImplementation((team) => Promise.resolve(team));
    remove.mockImplementation((team) => Promise.resolve(team));
    existsBy.mockResolvedValue(false);
    updatePlayers.mockResolvedValue({ affected: 1 });
    service = new TeamsService(repository, new DatabaseWriteService(dataSource));
  });

  it('maps ordered reads without exposing loaded relation objects', async () => {
    const team = repository.create(fields);
    team.players = [Object.assign(new Player(), { id: 'player' })];
    find.mockResolvedValue([team]);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('players');
    expect(find).toHaveBeenCalledWith({ order: { createdAt: 'ASC', id: 'ASC' } });
  });

  it('returns 404 before modifying dependent records for missing IDs', async () => {
    findOneBy.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('missing', actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(updatePlayers).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('normalizes all text before saving', async () => {
    await service.create(
      {
        name: ' Andes FC ',
        logoURL: ' https://example.com/logo.svg ',
        country: ' Colombia ',
        stadium: ' Demo Stadium ',
        foundedDate: ' 2020-02-29 ',
      },
      actor,
    );
    expect(save.mock.calls[0]?.[0]).toMatchObject(fields);
  });

  it('rejects an impossible date before persisting', async () => {
    await expect(
      service.create({ ...fields, foundedDate: '2025-02-29' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(save).not.toHaveBeenCalled();
  });

  it('validates the complete resulting entity during a partial update', async () => {
    findOneBy.mockResolvedValue(repository.create({ ...fields, foundedDate: '2025-02-29' }));
    await expect(service.update('team', { country: 'Spain' }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an empty update before any write', async () => {
    await expect(service.update('team', {}, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(save).not.toHaveBeenCalled();
  });

  it('compares accented names case-insensitively and rejects duplicates', async () => {
    find.mockResolvedValue([repository.create({ id: 'existing', name: 'Águilas FC' })]);
    await expect(service.create({ ...fields, name: 'ÁGUILAS FC' }, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('ignores the current ID when checking duplicate names', async () => {
    find.mockResolvedValue([repository.create(fields)]);
    await expect(service.update('team', { name: 'ANDES FC' }, actor)).resolves.toMatchObject({
      name: 'ANDES FC',
    });
  });

  // La comprobación de partidos debe ocurrir antes de cualquier desvinculación.
  it('blocks related matches without touching players or deleting the team', async () => {
    existsBy.mockResolvedValue(true);
    await expect(service.remove('team', actor)).rejects.toBeInstanceOf(ConflictException);
    expect(existsBy).toHaveBeenCalledWith([{ homeTeamId: 'team' }, { awayTeamId: 'team' }]);
    expect(updatePlayers).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('unassigns only matching players and updates their timestamps', async () => {
    await service.remove('team', actor);
    expect(updatePlayers.mock.calls[0]?.[0]).toEqual({ teamId: 'team' });
    expect(updatePlayers.mock.calls[0]?.[1].teamId).toBeNull();
    expect(updatePlayers.mock.calls[0]?.[1].updatedAt).toBeInstanceOf(Date);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('translates a database uniqueness failure without exposing SQL', async () => {
    save.mockRejectedValueOnce(
      new QueryFailedError(
        'private SQL',
        [],
        Object.assign(new Error('details'), { code: 'SQLITE_CONSTRAINT_UNIQUE' }),
      ),
    );
    await expect(service.create(fields, actor)).rejects.toBeInstanceOf(ConflictException);
  });

  it.each(['SQLITE_CONSTRAINT_FOREIGNKEY', 'SQLITE_CONSTRAINT_TRIGGER'])(
    'translates delete protection from %s',
    async (code) => {
      remove.mockRejectedValueOnce(
        new QueryFailedError('private SQL', [], Object.assign(new Error('details'), { code })),
      );
      await expect(service.remove('team', actor)).rejects.toBeInstanceOf(ConflictException);
    },
  );
});
