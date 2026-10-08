import { jest } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { DataSource, EntityManager, Repository } from 'typeorm';

import type { AuthenticatedUserInterface } from '../auth/interfaces/authenticated-user.interface.js';
import { DatabaseWriteService } from '../database/database-write.service.js';
import { Team } from '../teams/entities/team.entity.js';
import { User } from '../users/entities/user.entity.js';
import type { CreateMatchStatsDTO } from './dto/create-match-stats.dto.js';
import { MatchStats } from './entities/match-stats.entity.js';
import { MatchStatsService } from './match-stats.service.js';

// Aísla las reglas; FK, transacciones y HTTP se comprueban con SQLite en e2e.
describe('MatchStatsService', () => {
  const actor: AuthenticatedUserInterface = { id: 'admin', role: 'admin' };
  const homeTeamId = '20000000-0000-4000-8000-000000000001';
  const awayTeamId = '20000000-0000-4000-8000-000000000002';
  const fields: CreateMatchStatsDTO = {
    date: '2024-02-29',
    homeTeamId,
    awayTeamId,
    goalsHomeTeam: 2,
    goalsAwayTeam: 1,
    stadium: 'Demo Stadium',
    attendance: 100,
  };
  const find = jest.fn<() => Promise<MatchStats[]>>();
  const findOneBy =
    jest.fn<
      (criteria: {
        id?: string;
        date?: string;
        homeTeamId?: string;
        awayTeamId?: string;
      }) => Promise<MatchStats | null>
    >();
  const save = jest.fn<(matchStats: MatchStats) => Promise<MatchStats>>();
  const remove = jest.fn<(matchStats: MatchStats) => Promise<MatchStats>>();
  const existsBy = jest.fn<(criteria: { id: string }) => Promise<boolean>>();
  const repository = {
    find,
    findOneBy,
    save,
    remove,
    create: (values: Partial<MatchStats>): MatchStats =>
      Object.assign(
        new MatchStats(),
        {
          ...fields,
          id: 'match',
          createdAt: new Date('2020-01-01'),
          updatedAt: new Date('2020-01-01'),
        },
        values,
      ),
  } as unknown as Repository<MatchStats>;
  const manager = {
    getRepository: (entity: unknown): unknown => {
      if (entity === MatchStats) return repository;
      if (entity === Team) return { existsBy };
      if (entity === User) return { findOneBy: () => Promise.resolve(actor) };
      throw new Error('Unexpected repository');
    },
  } as unknown as EntityManager;
  const dataSource = {
    transaction: <T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> =>
      operation(manager),
  } as unknown as DataSource;
  let service: MatchStatsService;

  beforeEach(() => {
    jest.clearAllMocks();
    find.mockResolvedValue([]);
    findOneBy.mockImplementation((criteria) =>
      Promise.resolve(criteria.id ? repository.create(fields) : null),
    );
    save.mockImplementation((matchStats) => Promise.resolve(matchStats));
    remove.mockImplementation((matchStats) => Promise.resolve(matchStats));
    existsBy.mockResolvedValue(true);
    service = new MatchStatsService(repository, new DatabaseWriteService(dataSource));
  });

  it('maps loaded teams to IDs without exposing navigation properties', async () => {
    const matchStats = repository.create(fields);
    matchStats.homeTeam = Object.assign(new Team(), { id: homeTeamId });
    matchStats.awayTeam = Object.assign(new Team(), { id: awayTeamId });
    find.mockResolvedValue([matchStats]);
    const result = await service.findAll();
    expect(Object.keys(result[0] ?? {})).toHaveLength(10);
    expect(result[0]).not.toHaveProperty('homeTeam');
    expect(result[0]).not.toHaveProperty('awayTeam');
    expect(result[0]?.createdAt).toBe('2020-01-01T00:00:00.000Z');
  });

  it('trims date and stadium before checking the unique match key', async () => {
    await service.create({ ...fields, date: ' 2024-02-29 ', stadium: ' Demo Stadium ' }, actor);
    expect(save.mock.calls[0]?.[0]).toMatchObject(fields);
    expect(findOneBy).toHaveBeenCalledWith({ date: fields.date, homeTeamId, awayTeamId });
  });

  it.each([
    '2025-02-29',
    '1900-02-29',
    '2025-04-31',
    '0000-01-01',
    '9999-01-01',
    '2024-02-29T00:00:00Z',
  ])('rejects impossible, future or non-civil date %s', async (date) => {
    await expect(service.create({ ...fields, date }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it.each(['goalsHomeTeam', 'goalsAwayTeam', 'attendance'] as const)(
    'rejects non-finite or unsafe %s',
    async (field) => {
      for (const value of [NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
        await expect(service.create({ ...fields, [field]: value }, actor)).rejects.toBeInstanceOf(
          BadRequestException,
        );
      }
      expect(save).not.toHaveBeenCalled();
    },
  );

  it('rejects equal teams before querying or saving them', async () => {
    await expect(
      service.create({ ...fields, awayTeamId: homeTeamId }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(existsBy).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it.each([homeTeamId, awayTeamId])('rejects missing team %s', async (missingId) => {
    existsBy.mockImplementation(({ id }) => Promise.resolve(id !== missingId));
    await expect(service.create(fields, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects duplicate create and excludes the current record on update', async () => {
    findOneBy.mockResolvedValue(repository.create(fields));
    await expect(service.create(fields, actor)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.update('match', { goalsHomeTeam: 0 }, actor)).resolves.toMatchObject({
      goalsHomeTeam: 0,
    });
  });

  it('does not mutate a record when its changed key duplicates another match', async () => {
    const original = repository.create(fields);
    findOneBy.mockImplementation((criteria) =>
      Promise.resolve(criteria.id ? original : repository.create({ id: 'other' })),
    );
    await expect(service.update('match', { attendance: 999 }, actor)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(original.attendance).toBe(100);
    expect(save).not.toHaveBeenCalled();
  });

  it('validates the complete candidate when one team changes', async () => {
    await expect(service.update('match', { awayTeamId: homeTeamId }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects empty PATCH and returns 404 for missing records', async () => {
    await expect(service.update('match', {}, actor)).rejects.toBeInstanceOf(BadRequestException);
    findOneBy.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update('missing', { stadium: 'New' }, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.remove('missing', actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(remove).not.toHaveBeenCalled();
  });

  it.each([
    ['SQLITE_CONSTRAINT_UNIQUE', ConflictException],
    ['SQLITE_CONSTRAINT_FOREIGNKEY', BadRequestException],
  ] as const)('translates a late %s database failure without SQL', async (code, errorClass) => {
    save.mockRejectedValueOnce(
      new QueryFailedError('private SQL', [], Object.assign(new Error('private detail'), { code })),
    );
    await expect(service.create(fields, actor)).rejects.toBeInstanceOf(errorClass);
  });

  it('preserves unexpected errors for the global filter', async () => {
    const error = new Error('unexpected');
    save.mockRejectedValueOnce(error);
    await expect(service.create(fields, actor)).rejects.toBe(error);
  });
});
