import './test-environment.js';

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { DataSource } from 'typeorm';
import type { Repository } from 'typeorm';

import type { ApiErrorResponseDTO } from '../src/common/dto/api-error-response.dto.js';
import { createApplication } from '../src/create-application.js';
import { MatchStats } from '../src/match-stats/entities/match-stats.entity.js';
import { Player } from '../src/players/entities/player.entity.js';
import type { TeamResponseDTO } from '../src/teams/dto/team-response.dto.js';
import { Team } from '../src/teams/entities/team.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { PasswordService } from '../src/users/password.service.js';

// Verifica HTTP, JWT real, SQLite y FK: no reemplaza guards ni repositorios.
describe('Teams REST API (e2e)', () => {
  let application: INestApplication;
  let server: Server;
  let dataSource: DataSource;
  let teams: Repository<Team>;
  let players: Repository<Player>;
  let matches: Repository<MatchStats>;
  let users: Repository<User>;
  let passwordHash: string;
  const adminId = randomUUID();
  const regularId = randomUUID();
  const teamId = randomUUID();
  const otherTeamId = randomUUID();
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const fields = {
    name: 'Andes FC',
    logoURL: 'https://example.com/andes.svg',
    country: 'Colombia',
    stadium: 'Andes Stadium',
    foundedDate: '2000-02-29',
  };

  // La emisión de tokens queda dentro de la prueba; el login público corresponde a #47.
  function token(id = adminId): string {
    return jwt.sign({ sub: id }, { algorithm: 'HS256', expiresIn: '15m' });
  }

  async function createPlayer(relatedId: string | null): Promise<Player> {
    const player = players.create({
      name: 'Demo Player',
      position: 'Forward',
      status: 'active',
      teamId: relatedId,
      goals: 3,
      assists: 2,
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2020-01-01'),
    });
    return players.save(player);
  }

  beforeAll(async () => {
    application = await createApplication();
    await application.init();
    server = application.getHttpServer() as Server;
    dataSource = application.get(DataSource);
    teams = dataSource.getRepository(Team);
    players = dataSource.getRepository(Player);
    matches = dataSource.getRepository(MatchStats);
    users = dataSource.getRepository(User);
    passwordHash = await application.get(PasswordService).hashPassword('TeamFixture123');
  });

  beforeEach(async () => {
    // Limpia dependencias antes de sus padres, manteniendo FK habilitadas.
    await matches.clear();
    await players.clear();
    await teams.clear();
    await users.clear();
    await users.save(
      users.create([
        {
          id: adminId,
          name: 'Demo Admin',
          email: 'admin@soccer.example',
          role: 'admin',
          passwordHash,
        },
        {
          id: regularId,
          name: 'Demo User',
          email: 'user@soccer.example',
          role: 'user',
          passwordHash,
        },
      ]),
    );
    await teams.save(
      teams.create([
        { ...fields, id: teamId },
        { ...fields, id: otherTeamId, name: 'Costa FC' },
      ]),
    );
  });

  afterAll(async () => {
    await application.close();
  });

  // GET requiere sesión según #39; las tres mutaciones requieren además rol admin.
  it.each(['get', 'post', 'patch', 'delete'] as const)(
    '%s rejects missing sessions',
    async (method) => {
      const path = method === 'get' || method === 'post' ? '/api/teams' : `/api/teams/${teamId}`;
      await request(server)[method](path).send(fields).expect(401);
    },
  );

  it.each(['post', 'patch', 'delete'] as const)(
    '%s rejects regular users before inspecting the resource',
    async (method) => {
      const path = method === 'post' ? '/api/teams' : `/api/teams/${randomUUID()}`;
      await request(server)
        [method](path)
        .auth(token(regularId), { type: 'bearer' })
        .send(fields)
        .expect(403);
    },
  );

  it('allows regular users to list and read database teams without nested relations', async () => {
    const response = await request(server)
      .get('/api/teams')
      .auth(token(regularId), { type: 'bearer' })
      .expect(200);
    const profiles = response.body as TeamResponseDTO[];
    expect(profiles).toHaveLength(2);
    const ordered = await teams.find({ order: { createdAt: 'ASC', id: 'ASC' } });
    expect(profiles.map((team) => team.id)).toEqual(ordered.map((team) => team.id));
    const single = await request(server)
      .get(`/api/teams/${teamId}`)
      .auth(token(regularId), { type: 'bearer' })
      .expect(200);
    expect(single.body).toMatchObject({ id: teamId, ...fields });
    expect(Object.keys(single.body as TeamResponseDTO).sort()).toEqual(
      [
        'id',
        'name',
        'logoURL',
        'country',
        'stadium',
        'foundedDate',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
  });

  it('returns an empty array when the database has no teams', async () => {
    await teams.clear();
    await request(server)
      .get('/api/teams')
      .auth(token(regularId), { type: 'bearer' })
      .expect(200)
      .expect([]);
  });

  it('creates with 201, trims every text field, and preserves the civil date', async () => {
    const response = await request(server)
      .post('/api/teams')
      .auth(token(), { type: 'bearer' })
      .send({
        name: '  Valle FC  ',
        logoURL: ' https://example.com/valle.svg ',
        country: ' Colombia ',
        stadium: ' Valle Stadium ',
        foundedDate: ' 2024-02-29 ',
      })
      .expect(201);
    const team = response.body as TeamResponseDTO;
    expect(team).toMatchObject({
      name: 'Valle FC',
      logoURL: 'https://example.com/valle.svg',
      country: 'Colombia',
      stadium: 'Valle Stadium',
      foundedDate: '2024-02-29',
    });
    expect(team.createdAt).toMatch(/Z$/);
    expect(await teams.count()).toBe(3);
    expect((await teams.findOneByOrFail({ id: team.id })).foundedDate).toBe('2024-02-29');
  });

  it('accepts a founded date of today in UTC', async () => {
    await request(server)
      .post('/api/teams')
      .auth(token(), { type: 'bearer' })
      .send({ ...fields, name: 'Today FC', foundedDate: new Date().toISOString().slice(0, 10) })
      .expect(201);
  });

  it('updates with 200 and preserves omitted fields, creation timestamp and player links', async () => {
    const player = await createPlayer(teamId);
    const before = await teams.findOneByOrFail({ id: teamId });
    const response = await request(server)
      .patch(`/api/teams/${teamId}`)
      .auth(token(), { type: 'bearer' })
      .send({ name: '  Updated Andes  ', country: ' Spain ' })
      .expect(200);
    expect(response.body).toMatchObject({
      name: 'Updated Andes',
      country: 'Spain',
      stadium: fields.stadium,
      logoURL: fields.logoURL,
      foundedDate: fields.foundedDate,
      createdAt: before.createdAt.toISOString(),
    });
    expect((await players.findOneByOrFail({ id: player.id })).teamId).toBe(teamId);
  });

  it('trims every editable field on PATCH', async () => {
    await request(server)
      .patch(`/api/teams/${teamId}`)
      .auth(token(), { type: 'bearer' })
      .send({
        name: ' Updated FC ',
        country: ' Spain ',
        stadium: ' New Stadium ',
        logoURL: ' https://example.com/new.svg ',
        foundedDate: ' 2020-02-29 ',
      })
      .expect(200);
    expect(await teams.findOneByOrFail({ id: teamId })).toMatchObject({
      name: 'Updated FC',
      country: 'Spain',
      stadium: 'New Stadium',
      logoURL: 'https://example.com/new.svg',
      foundedDate: '2020-02-29',
    });
  });

  it('rejects case-insensitive duplicates on POST and PATCH without partial changes', async () => {
    await request(server)
      .post('/api/teams')
      .auth(token(), { type: 'bearer' })
      .send({ ...fields, name: ' ANDES fc ' })
      .expect(409);
    await request(server)
      .patch(`/api/teams/${otherTeamId}`)
      .auth(token(), { type: 'bearer' })
      .send({ name: ' ANDES FC ', stadium: 'Must Not Change' })
      .expect(409);
    expect((await teams.findOneByOrFail({ id: otherTeamId })).stadium).toBe(fields.stadium);
    expect(await teams.count()).toBe(2);
  });

  it('rejects accented names differing only in case', async () => {
    await teams.save(teams.create({ ...fields, name: 'Águilas FC' }));
    await request(server)
      .post('/api/teams')
      .auth(token(), { type: 'bearer' })
      .send({ ...fields, name: 'ÁGUILAS FC' })
      .expect(409);
  });

  it('allows retaining the current name with a different case', async () => {
    await request(server)
      .patch(`/api/teams/${teamId}`)
      .auth(token(), { type: 'bearer' })
      .send({ name: ' ANDES FC ' })
      .expect(200);
    expect((await teams.findOneByOrFail({ id: teamId })).name).toBe('ANDES FC');
  });

  // Entradas inválidas se rechazan en backend sin depender del formulario Vue.
  it.each([
    ['missing fields', {}],
    ['blank name', { ...fields, name: ' ' }],
    ['name object', { ...fields, name: { id: teamId } }],
    ['blank country', { ...fields, country: '\t ' }],
    ['non-string country', { ...fields, country: 12 }],
    ['blank stadium', { ...fields, stadium: ' ' }],
    ['blank logo', { ...fields, logoURL: ' ' }],
    ['relative logo', { ...fields, logoURL: '/logo.svg' }],
    ['unqualified logo', { ...fields, logoURL: 'example.com/logo.svg' }],
    ['FTP logo', { ...fields, logoURL: 'ftp://example.com/logo.svg' }],
    ['script logo', { ...fields, logoURL: 'javascript:alert(1)' }],
    ['future date', { ...fields, foundedDate: '9999-01-01' }],
    ['non-leap date', { ...fields, foundedDate: '2025-02-29' }],
    ['invalid century leap date', { ...fields, foundedDate: '1900-02-29' }],
    ['invalid month day', { ...fields, foundedDate: '2025-04-31' }],
    ['invalid month', { ...fields, foundedDate: '2025-13-01' }],
    ['invalid format', { ...fields, foundedDate: '01/01/2025' }],
    ['timestamp date', { ...fields, foundedDate: '2025-01-01T00:00:00Z' }],
    ['zero year', { ...fields, foundedDate: '0000-01-01' }],
    ['server ID', { ...fields, id: randomUUID() }],
    ['embedded team', { ...fields, team: { id: teamId } }],
    ['embedded players', { ...fields, players: [{ id: randomUUID() }] }],
    ['client timestamp', { ...fields, createdAt: '2025-01-01' }],
  ])('rejects %s on POST', async (_description, payload) => {
    await request(server)
      .post('/api/teams')
      .auth(token(), { type: 'bearer' })
      .send(payload)
      .expect(400);
    expect(await teams.count()).toBe(2);
  });

  it.each([
    {},
    { name: null },
    { logoURL: null },
    { country: null },
    { stadium: null },
    { foundedDate: null },
    { foundedDate: '2025-02-29' },
    { foundedDate: '9999-01-01' },
    { logoURL: '/invalid.svg' },
    { country: '' },
    { teamId: teamId },
    { team: { id: teamId } },
  ])('rejects invalid partial updates %#', async (payload) => {
    await request(server)
      .patch(`/api/teams/${teamId}`)
      .auth(token(), { type: 'bearer' })
      .send(payload)
      .expect(400);
    expect((await teams.findOneByOrFail({ id: teamId })).name).toBe(fields.name);
  });

  it.each(['get', 'patch', 'delete'] as const)('%s returns 404 for missing IDs', async (method) => {
    await request(server)
      [method](`/api/teams/${randomUUID()}`)
      .auth(token(), { type: 'bearer' })
      .send({ name: 'Updated' })
      .expect(404);
  });

  it.each(['get', 'patch', 'delete'] as const)('%s rejects malformed IDs', async (method) => {
    await request(server)
      [method]('/api/teams/not-a-uuid')
      .auth(token(), { type: 'bearer' })
      .send({ name: 'Updated' })
      .expect(400);
  });

  // Evalúa ambas FK de MatchStats y confirma que no se desvincula ningún jugador.
  it.each(['home', 'away'] as const)(
    'blocks deletion of a referenced %s team without partial changes',
    async (side) => {
      const player = await createPlayer(teamId);
      await matches.save(
        matches.create({
          date: '2025-01-01',
          homeTeamId: side === 'home' ? teamId : otherTeamId,
          awayTeamId: side === 'away' ? teamId : otherTeamId,
          goalsHomeTeam: 1,
          goalsAwayTeam: 0,
          stadium: 'Demo Stadium',
          attendance: 100,
        }),
      );
      await request(server)
        .delete(`/api/teams/${teamId}`)
        .auth(token(), { type: 'bearer' })
        .expect(409);
      expect(await teams.existsBy({ id: teamId })).toBe(true);
      const after = await players.findOneByOrFail({ id: player.id });
      expect(after.teamId).toBe(teamId);
      expect(after.updatedAt).toEqual(player.updatedAt);
      expect(await matches.count()).toBe(1);
    },
  );

  it('deletes with 204 and unassigns only related players without altering their statistics or status', async () => {
    const player = await createPlayer(teamId);
    const another = await createPlayer(teamId);
    const unrelated = await createPlayer(otherTeamId);
    const alreadyFree = await createPlayer(null);
    const response = await request(server)
      .delete(`/api/teams/${teamId}`)
      .auth(token(), { type: 'bearer' })
      .expect(204);
    expect(response.text).toBe('');
    expect(await teams.existsBy({ id: teamId })).toBe(false);
    for (const id of [player.id, another.id]) {
      const after = await players.findOneByOrFail({ id });
      expect(after).toMatchObject({ teamId: null, goals: 3, assists: 2, status: 'active' });
      expect(after.updatedAt.getTime()).toBeGreaterThan(player.updatedAt.getTime());
      expect(after.createdAt).toEqual(player.createdAt);
    }
    expect((await players.findOneByOrFail({ id: unrelated.id })).teamId).toBe(otherTeamId);
    expect((await players.findOneByOrFail({ id: unrelated.id })).updatedAt).toEqual(
      unrelated.updatedAt,
    );
    expect((await players.findOneByOrFail({ id: alreadyFree.id })).updatedAt).toEqual(
      alreadyFree.updatedAt,
    );
    expect(await players.count()).toBe(4);
  });

  it('rolls back player unassignment if the final delete fails', async () => {
    const player = await createPlayer(teamId);
    // Simula un fallo DB posterior al UPDATE para comprobar el rollback real.
    await dataSource.query(
      `CREATE TRIGGER "test_block_team_delete" BEFORE DELETE ON "teams" BEGIN SELECT RAISE(ABORT, 'Simulated database failure'); END`,
    );
    try {
      await request(server)
        .delete(`/api/teams/${teamId}`)
        .auth(token(), { type: 'bearer' })
        .expect(409);
      expect(await teams.existsBy({ id: teamId })).toBe(true);
      const after = await players.findOneByOrFail({ id: player.id });
      expect(after.teamId).toBe(teamId);
      expect(after.updatedAt).toEqual(player.updatedAt);
    } finally {
      await dataSource.query('DROP TRIGGER "test_block_team_delete"');
    }
  });

  it('deletes a team that has no players and no matches', async () => {
    await request(server)
      .delete(`/api/teams/${teamId}`)
      .auth(token(), { type: 'bearer' })
      .expect(204);
    expect(await teams.count()).toBe(1);
  });

  // Comprueba escrituras de dominios diferentes en la conexión compartida y duplicados.
  it('serializes concurrent team and user updates without nested transactions', async () => {
    const results = await Promise.all([
      request(server)
        .patch(`/api/teams/${teamId}`)
        .auth(token(), { type: 'bearer' })
        .send({ stadium: 'Updated Stadium' }),
      request(server)
        .patch(`/api/users/${regularId}`)
        .auth(token(), { type: 'bearer' })
        .send({ name: 'Updated User' }),
    ]);
    expect(results.map((response) => response.status)).toEqual([200, 200]);
    expect((await teams.findOneByOrFail({ id: teamId })).stadium).toBe('Updated Stadium');
    expect((await users.findOneByOrFail({ id: regularId })).name).toBe('Updated User');
  });

  it('allows exactly one of two simultaneous duplicate team creations', async () => {
    const results = await Promise.all([
      request(server)
        .post('/api/teams')
        .auth(token(), { type: 'bearer' })
        .send({ ...fields, name: 'New FC' }),
      request(server)
        .post('/api/teams')
        .auth(token(), { type: 'bearer' })
        .send({ ...fields, name: ' NEW FC ' }),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await teams.count()).toBe(3);
  });

  it('returns the shared safe error envelope', async () => {
    const response = await request(server)
      .get(`/api/teams/${randomUUID()}`)
      .auth(token(), { type: 'bearer' })
      .expect(404);
    const error = response.body as ApiErrorResponseDTO;
    expect(error).toMatchObject({ statusCode: 404, message: ['Team not found.'] });
    expect(error.path).toMatch(/^\/api\/teams\//);
    expect(error.timestamp).toMatch(/Z$/);
    expect(JSON.stringify(error)).not.toMatch(/SQL|stack|passwordHash/);
  });
});
