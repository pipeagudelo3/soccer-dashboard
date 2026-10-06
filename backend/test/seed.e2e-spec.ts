import './test-environment.js';

import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { validateEnvironment } from '../src/config/environment.js';
import { createApplication } from '../src/create-application.js';
import { createDatabaseOptions } from '../src/database/database-options.js';
import { initializeDatabase } from '../src/database/initialize-database.js';
import { MatchStats } from '../src/match-stats/entities/match-stats.entity.js';
import { Player } from '../src/players/entities/player.entity.js';
import { seedMatchStats, seedPlayers, seedTeams, seedUsers } from '../src/seed/seed-data.js';
import { SeedService } from '../src/seed/seed.service.js';
import { Team } from '../src/teams/entities/team.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { PasswordService } from '../src/users/password.service.js';

// Usa un driver SQLite real con una base nueva por caso; no toca datos de desarrollo.
describe('Idempotent backend seed (e2e)', () => {
  let dataSource: DataSource;
  let service: SeedService;
  const passwords = new PasswordService();

  beforeEach(async () => {
    const configuration = validateEnvironment({
      NODE_ENV: 'test',
      JWT_SECRET: 'seed-e2e-test-secret-with-at-least-32-bytes',
      SQLITE_PATH: ':memory:',
    });
    dataSource = await initializeDatabase(createDatabaseOptions(configuration));
    service = new SeedService(dataSource, passwords);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  // Comprueba hashes con la misma política que usarán Users/Auth, sin simularla.
  it('creates all fixtures with valid relationships and verifiable demo passwords', async () => {
    const result = await service.run();
    expect(result).toEqual({
      teams: { created: 4, skipped: 0 },
      users: { created: 2, skipped: 0 },
      players: { created: 8, skipped: 0 },
      matchStats: { created: 4, skipped: 0 },
    });
    for (const fixture of seedUsers) {
      const user = await dataSource
        .getRepository(User)
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.id = :id', { id: fixture.id })
        .getOneOrFail();
      expect(user.role).toBe(fixture.role);
      expect(user.passwordHash).not.toBe(fixture.password);
      await expect(passwords.verifyPassword(fixture.password, user.passwordHash)).resolves.toBe(
        true,
      );
      expect(JSON.stringify(user)).not.toContain(user.passwordHash);
    }
    const players = await dataSource.getRepository(Player).find({ relations: { team: true } });
    expect(players.some((player) => player.teamId === null)).toBe(true);
    for (const player of players) {
      if (player.teamId !== null) expect(player.team?.id).toBe(player.teamId);
    }
    const matches = await dataSource
      .getRepository(MatchStats)
      .find({ relations: { homeTeam: true, awayTeam: true } });
    expect(matches).toHaveLength(4);
    for (const match of matches) {
      expect(match.homeTeamId).not.toBe(match.awayTeamId);
      expect(match.homeTeam.id).toBe(match.homeTeamId);
      expect(match.awayTeam.id).toBe(match.awayTeamId);
    }
  });

  it('skips all records on repeated runs without changing timestamps or hashes', async () => {
    await service.run();
    const beforeUsers = await dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .orderBy('user.id')
      .getMany();
    const beforeTeams = await dataSource.getRepository(Team).find({ order: { id: 'ASC' } });
    const repeat = await service.run();
    expect(repeat).toEqual({
      teams: { created: 0, skipped: 4 },
      users: { created: 0, skipped: 2 },
      players: { created: 0, skipped: 8 },
      matchStats: { created: 0, skipped: 4 },
    });
    const afterUsers = await dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .orderBy('user.id')
      .getMany();
    expect(afterUsers.map((user) => user.passwordHash)).toEqual(
      beforeUsers.map((user) => user.passwordHash),
    );
    expect(afterUsers.map((user) => user.updatedAt)).toEqual(
      beforeUsers.map((user) => user.updatedAt),
    );
    expect(await dataSource.getRepository(Team).find({ order: { id: 'ASC' } })).toEqual(
      beforeTeams,
    );
    expect(await dataSource.getRepository(Player).count()).toBe(8);
    expect(await dataSource.getRepository(MatchStats).count()).toBe(4);
  });

  it('preserves user edits and custom records instead of restoring fixture values', async () => {
    await service.run();
    const userFixture = seedUsers[0];
    const teamFixture = seedTeams[0];
    const playerFixture = seedPlayers[0];
    const matchFixture = seedMatchStats[0];
    if (!userFixture || !teamFixture || !playerFixture || !matchFixture)
      throw new Error('Required fixtures are missing.');
    const editedHash = await passwords.hashPassword('EditedPass123');
    await dataSource.getRepository(User).update(userFixture.id, {
      name: 'Edited Admin',
      email: 'edited@soccer.example',
      role: 'user',
      passwordHash: editedHash,
    });
    await dataSource.getRepository(Team).update(teamFixture.id, { name: 'Edited Team' });
    await dataSource
      .getRepository(Player)
      .update(playerFixture.id, { name: 'Edited Player', goals: 99, teamId: null });
    await dataSource
      .getRepository(MatchStats)
      .update(matchFixture.id, { goalsHomeTeam: 7, date: '2025-07-01' });
    await dataSource.getRepository(Player).insert({
      name: 'Custom Player',
      position: 'Defender',
      status: 'active',
      teamId: null,
      goals: 0,
      assists: 0,
    });
    await service.run();
    const user = await dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userFixture.id })
      .getOneOrFail();
    expect(user.name).toBe('Edited Admin');
    expect(user.email).toBe('edited@soccer.example');
    expect(user.role).toBe('user');
    expect(user.passwordHash).toBe(editedHash);
    expect(
      (await dataSource.getRepository(Team).findOneByOrFail({ id: teamFixture.id })).name,
    ).toBe('Edited Team');
    const player = await dataSource.getRepository(Player).findOneByOrFail({ id: playerFixture.id });
    expect(player.goals).toBe(99);
    expect(player.teamId).toBeNull();
    const match = await dataSource
      .getRepository(MatchStats)
      .findOneByOrFail({ id: matchFixture.id });
    expect(match.goalsHomeTeam).toBe(7);
    expect(match.date).toBe('2025-07-01');
    expect(await dataSource.getRepository(Player).count()).toBe(9);
  });

  it('reuses existing team names and user emails without changing IDs, role or credentials', async () => {
    const fixture = seedTeams[0];
    const userFixture = seedUsers[0];
    if (!fixture || !userFixture) throw new Error('Required fixtures are missing.');
    const customTeamId = randomUUID();
    await dataSource
      .getRepository(Team)
      .save(dataSource.getRepository(Team).create({ ...fixture, id: customTeamId }));
    const existingHash = await passwords.hashPassword('ExistingPass123');
    const customUserId = randomUUID();
    await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        id: customUserId,
        name: 'Existing User',
        email: userFixture.email,
        role: 'user',
        passwordHash: existingHash,
      }),
    );
    const result = await service.run();
    expect(result.teams).toEqual({ created: 3, skipped: 1 });
    expect(result.users).toEqual({ created: 1, skipped: 1 });
    expect(await dataSource.getRepository(Team).count()).toBe(4);
    const players = await dataSource.getRepository(Player).findBy({ teamId: customTeamId });
    expect(players).toHaveLength(2);
    expect(await dataSource.getRepository(MatchStats).count()).toBe(4);
    const existing = await dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: customUserId })
      .getOneOrFail();
    expect(existing.role).toBe('user');
    expect(existing.passwordHash).toBe(existingHash);
    expect(await dataSource.getRepository(User).existsBy({ id: userFixture.id })).toBe(false);
  });

  it('does not duplicate a match that already has the same date and teams with another ID', async () => {
    await service.run();
    const fixture = seedMatchStats[0];
    if (!fixture) throw new Error('Required match fixture is missing.');
    await dataSource.getRepository(MatchStats).delete(fixture.id);
    const customId = randomUUID();
    await dataSource.getRepository(MatchStats).insert({ ...fixture, id: customId });
    const result = await service.run();
    expect(result.matchStats).toEqual({ created: 0, skipped: 4 });
    expect(await dataSource.getRepository(MatchStats).count()).toBe(4);
    expect(await dataSource.getRepository(MatchStats).existsBy({ id: customId })).toBe(true);
  });

  it('rolls back the entire batch when hashing fails', async () => {
    class FailingPasswordService extends PasswordService {
      override hashPassword(): Promise<string> {
        return Promise.reject(new Error('Simulated hash failure.'));
      }
    }
    const failingService = new SeedService(dataSource, new FailingPasswordService());
    await expect(failingService.run()).rejects.toThrow('Simulated hash failure');
    const counts = await Promise.all([
      dataSource.getRepository(User).count(),
      dataSource.getRepository(Team).count(),
      dataSource.getRepository(Player).count(),
      dataSource.getRepository(MatchStats).count(),
    ]);
    expect(counts).toEqual([0, 0, 0, 0]);
  });

  it('leaves a normally started backend empty instead of seeding on reload', async () => {
    const application = await createApplication();
    try {
      await application.init();
      const applicationDataSource = application.get(DataSource);
      expect(await applicationDataSource.getRepository(User).count()).toBe(0);
      expect(await applicationDataSource.getRepository(Team).count()).toBe(0);
    } finally {
      await application.close();
    }
  });
});
