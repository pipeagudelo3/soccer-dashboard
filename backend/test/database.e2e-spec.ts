import './test-environment.js';

import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DataSource } from 'typeorm';

import { validateEnvironment } from '../src/config/environment.js';
import { createDatabaseOptions } from '../src/database/database-options.js';
import { initializeDatabase } from '../src/database/initialize-database.js';
import { databaseMigrations } from '../src/database/migration-registry.js';
import { MatchStats } from '../src/match-stats/entities/match-stats.entity.js';
import { Player } from '../src/players/entities/player.entity.js';
import { Team } from '../src/teams/entities/team.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { PasswordService } from '../src/users/password.service.js';

// Construye configuración aislada; nunca utiliza archivos ni datos de un usuario real.
function createConfiguration(databasePath = ':memory:', synchronize = true) {
  return validateEnvironment({
    NODE_ENV: 'test',
    JWT_SECRET: 'database-only-test-secret-at-least-32-bytes',
    SQLITE_PATH: databasePath,
    SQLITE_SYNCHRONIZE: String(synchronize),
  });
}

// Reutiliza fixtures tipados mínimos sin insertar datos durante el arranque del backend.
async function createTeam(dataSource: DataSource, name: string): Promise<Team> {
  const repository = dataSource.getRepository(Team);
  return repository.save(
    repository.create({
      name,
      logoURL: 'https://example.com/team.png',
      country: 'Colombia',
      stadium: 'Test Stadium',
      foundedDate: '2000-01-01',
    }),
  );
}

async function createPlayer(dataSource: DataSource, teamId: string | null): Promise<Player> {
  const repository = dataSource.getRepository(Player);
  return repository.save(
    repository.create({
      name: 'Fictional Player',
      position: 'Forward',
      status: 'active',
      teamId,
      goals: 1,
      assists: 2,
    }),
  );
}

async function createMatch(
  dataSource: DataSource,
  homeTeamId: string,
  awayTeamId: string,
): Promise<MatchStats> {
  const repository = dataSource.getRepository(MatchStats);
  return repository.save(
    repository.create({
      date: '2026-01-01',
      homeTeamId,
      awayTeamId,
      goalsHomeTeam: 1,
      goalsAwayTeam: 0,
      stadium: 'Test Stadium',
      attendance: 100,
    }),
  );
}

// Cada caso dispone de un esquema nuevo y cierra su conexión al terminar.
describe('SQLite domain constraints (e2e)', () => {
  let dataSource: DataSource;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await new PasswordService().hashPassword('FictionalPass123');
  });

  beforeEach(async () => {
    dataSource = await initializeDatabase(createDatabaseOptions(createConfiguration()));
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('registers only the four canonical entities and generates UUIDs/timestamps', async () => {
    expect(dataSource.entityMetadatas.map((metadata) => metadata.name).sort()).toEqual([
      'MatchStats',
      'Player',
      'Team',
      'User',
    ]);
    const team = await createTeam(dataSource, 'Team One');
    expect(team.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(team.createdAt).toBeInstanceOf(Date);
    expect(team.updatedAt).toBeInstanceOf(Date);
    expect(JSON.parse(JSON.stringify(team)) as { createdAt: string }).toHaveProperty(
      'createdAt',
      team.createdAt.toISOString(),
    );
  });

  it('excludes hashes from normal reads and JSON even after an explicit secret selection', async () => {
    const repository = dataSource.getRepository(User);
    const user = await repository.save(
      repository.create({
        name: ' Fictional Admin ',
        email: ' ADMIN@EXAMPLE.COM ',
        role: 'admin',
        passwordHash,
      }),
    );
    const normalRead = await repository.findOneByOrFail({ id: user.id });
    expect(normalRead.email).toBe('admin@example.com');
    expect(normalRead.passwordHash).toBeUndefined();
    const selectedHash = await repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: user.id })
      .getOneOrFail();
    expect(selectedHash.passwordHash).toBe(passwordHash);
    expect(JSON.stringify(selectedHash)).not.toContain('passwordHash');
    expect(JSON.stringify(selectedHash)).not.toContain(passwordHash);
  });

  it('enforces email uniqueness in SQLite independently of normalization hooks', async () => {
    await dataSource.query(
      'INSERT INTO users (id, name, email, role, passwordHash) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), 'User One', 'admin@example.com', 'admin', passwordHash],
    );
    await expect(
      dataSource.query(
        'INSERT INTO users (id, name, email, role, passwordHash) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), 'User Two', 'ADMIN@EXAMPLE.COM', 'user', passwordHash],
      ),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('rejects plaintext values in the password hash column', async () => {
    await expect(
      dataSource.getRepository(User).insert({
        name: 'User',
        email: 'user@example.com',
        role: 'user',
        passwordHash: 'PlaintextPass123',
      }),
    ).rejects.toThrow(/CHECK/);
  });

  it('enforces unique team names at database level', async () => {
    await createTeam(dataSource, 'Team One');
    await expect(createTeam(dataSource, 'TEAM ONE')).rejects.toThrow(/UNIQUE/);
  });

  it('persists and loads optional team/player relationships', async () => {
    const team = await createTeam(dataSource, 'Team One');
    const assigned = await createPlayer(dataSource, team.id);
    const unassigned = await createPlayer(dataSource, null);
    const loaded = await dataSource.getRepository(Player).findOneOrFail({
      where: { id: assigned.id },
      relations: { team: true },
    });
    expect(loaded.team?.id).toBe(team.id);
    expect(unassigned.teamId).toBeNull();
    const loadedTeam = await dataSource.getRepository(Team).findOneOrFail({
      where: { id: team.id },
      relations: { players: true },
    });
    expect(loadedTeam.players.map((player) => player.id)).toEqual([assigned.id]);
  });

  it('rejects a player referencing an unknown team', async () => {
    await expect(createPlayer(dataSource, randomUUID())).rejects.toThrow(/FOREIGN KEY/);
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid player goals (%s)',
    async (goals) => {
      await expect(
        dataSource.getRepository(Player).insert({
          name: 'Player',
          position: 'Forward',
          status: 'active',
          teamId: null,
          goals,
          assists: 0,
        }),
      ).rejects.toThrow(/CHECK/);
    },
  );

  it('rejects negative assists and invalid player status', async () => {
    const player = await createPlayer(dataSource, null);
    await expect(
      dataSource.getRepository(Player).update(player.id, { assists: -1 }),
    ).rejects.toThrow(/CHECK/);
    await expect(
      dataSource.query('UPDATE players SET status = ? WHERE id = ?', ['invalid', player.id]),
    ).rejects.toThrow(/CHECK/);
  });

  it('unassigns players and updates timestamps when a team without matches is removed', async () => {
    const team = await createTeam(dataSource, 'Team One');
    const player = await createPlayer(dataSource, team.id);
    const oldTimestamp = new Date('2000-01-01T00:00:00.000Z');
    await dataSource.getRepository(Player).update(player.id, { updatedAt: oldTimestamp });
    await dataSource.getRepository(Team).delete(team.id);
    const reloaded = await dataSource.getRepository(Player).findOneByOrFail({ id: player.id });
    expect(reloaded.teamId).toBeNull();
    expect(reloaded.updatedAt.getTime()).toBeGreaterThan(oldTimestamp.getTime());
  });

  it('loads home and away teams and blocks deletion without partially unassigning players', async () => {
    const home = await createTeam(dataSource, 'Home Team');
    const away = await createTeam(dataSource, 'Away Team');
    const player = await createPlayer(dataSource, home.id);
    const match = await createMatch(dataSource, home.id, away.id);
    const loaded = await dataSource.getRepository(MatchStats).findOneOrFail({
      where: { id: match.id },
      relations: { homeTeam: true, awayTeam: true },
    });
    expect(loaded.homeTeam.id).toBe(home.id);
    expect(loaded.awayTeam.id).toBe(away.id);
    await expect(dataSource.getRepository(Team).delete(home.id)).rejects.toThrow(/FOREIGN KEY/);
    await expect(dataSource.getRepository(Team).delete(away.id)).rejects.toThrow(/FOREIGN KEY/);
    expect((await dataSource.getRepository(Player).findOneByOrFail({ id: player.id })).teamId).toBe(
      home.id,
    );
    expect(await dataSource.getRepository(Team).count()).toBe(2);
  });

  it('rejects equal/unknown match teams and duplicate matches', async () => {
    const home = await createTeam(dataSource, 'Home Team');
    const away = await createTeam(dataSource, 'Away Team');
    await expect(createMatch(dataSource, home.id, home.id)).rejects.toThrow(/CHECK/);
    await expect(createMatch(dataSource, home.id, randomUUID())).rejects.toThrow(/FOREIGN KEY/);
    await createMatch(dataSource, home.id, away.id);
    await expect(createMatch(dataSource, home.id, away.id)).rejects.toThrow(/UNIQUE/);
  });

  it.each(['goalsHomeTeam', 'goalsAwayTeam', 'attendance'] as const)(
    'rejects negative match %s',
    async (field) => {
      const home = await createTeam(dataSource, 'Home Team');
      const away = await createTeam(dataSource, 'Away Team');
      const match = await createMatch(dataSource, home.id, away.id);
      await expect(
        dataSource.getRepository(MatchStats).update(match.id, { [field]: -1 }),
      ).rejects.toThrow(/CHECK/);
    },
  );

  it('updates timestamps on save and keeps teams after deleting a player or match', async () => {
    const home = await createTeam(dataSource, 'Home Team');
    const away = await createTeam(dataSource, 'Away Team');
    const player = await createPlayer(dataSource, home.id);
    const match = await createMatch(dataSource, home.id, away.id);
    await dataSource
      .getRepository(Player)
      .update(player.id, { updatedAt: new Date('2000-01-01T00:00:00Z') });
    const loaded = await dataSource.getRepository(Player).findOneByOrFail({ id: player.id });
    loaded.goals = 2;
    const updated = await dataSource.getRepository(Player).save(loaded);
    expect(updated.updatedAt.getUTCFullYear()).toBeGreaterThan(2000);
    await dataSource.getRepository(Player).delete(player.id);
    await dataSource.getRepository(MatchStats).delete(match.id);
    expect(await dataSource.getRepository(Team).count()).toBe(2);
  });
});

// Verifica una base física temporal y el camino de despliegue sin synchronize.
describe('File persistence and migrations (e2e)', () => {
  it('runs the initial migration once and preserves data when reopening SQLite', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'soccer-database-test-'));
    const configuration = createConfiguration(join(directory, 'nested', 'database.sqlite'), false);
    let dataSource: DataSource | undefined;

    try {
      dataSource = await initializeDatabase(
        createDatabaseOptions(configuration, databaseMigrations),
      );
      expect(await dataSource.runMigrations()).toHaveLength(1);
      expect(await dataSource.runMigrations()).toHaveLength(0);
      const team = await createTeam(dataSource, 'Persistent Team');
      const player = await createPlayer(dataSource, team.id);
      await dataSource.destroy();
      dataSource = await initializeDatabase(
        createDatabaseOptions(configuration, databaseMigrations),
      );
      expect((await dataSource.getRepository(Team).findOneByOrFail({ id: team.id })).name).toBe(
        'Persistent Team',
      );
      expect(
        (await dataSource.getRepository(Player).findOneByOrFail({ id: player.id })).teamId,
      ).toBe(team.id);
      const schemaDifference = await dataSource.driver.createSchemaBuilder().log();
      expect(schemaDifference.upQueries).toHaveLength(0);
      await dataSource.getRepository(Team).delete(team.id);
      expect(
        (await dataSource.getRepository(Player).findOneByOrFail({ id: player.id })).teamId,
      ).toBeNull();
    } finally {
      if (dataSource?.isInitialized) await dataSource.destroy();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
