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
import type { PlayerResponseDTO } from '../src/players/dto/player-response.dto.js';
import { Player } from '../src/players/entities/player.entity.js';
import { Team } from '../src/teams/entities/team.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { PasswordService } from '../src/users/password.service.js';

// Verifica el contrato HTTP con guards JWT, SQLite y relaciones reales.
describe('Players REST API (e2e)', () => {
  let application: INestApplication;
  let server: Server;
  let dataSource: DataSource;
  let players: Repository<Player>;
  let teams: Repository<Team>;
  let users: Repository<User>;
  let passwordHash: string;
  const adminId = randomUUID();
  const regularId = randomUUID();
  const playerId = randomUUID();
  const teamId = randomUUID();
  const otherTeamId = randomUUID();
  const fields = {
    name: 'Demo Player',
    position: 'Forward',
    status: 'active' as const,
    teamId,
    goals: 3,
    assists: 2,
  };
  const publicKeys = [
    'id',
    'name',
    'position',
    'status',
    'teamId',
    'goals',
    'assists',
    'createdAt',
    'updatedAt',
  ];
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });

  // Tokens solo de prueba: no agrega un login público antes del issue #47.
  function token(id = adminId): string {
    return jwt.sign({ sub: id }, { algorithm: 'HS256', expiresIn: '15m' });
  }

  beforeAll(async () => {
    application = await createApplication();
    await application.init();
    server = application.getHttpServer() as Server;
    dataSource = application.get(DataSource);
    players = dataSource.getRepository(Player);
    teams = dataSource.getRepository(Team);
    users = dataSource.getRepository(User);
    passwordHash = await application.get(PasswordService).hashPassword('PlayerFixture123');
  });

  beforeEach(async () => {
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
    const teamFields = {
      logoURL: 'https://example.com/logo.svg',
      country: 'Colombia',
      stadium: 'Demo Stadium',
      foundedDate: '2000-01-01',
    };
    await teams.save(
      teams.create([
        { ...teamFields, id: teamId, name: 'Andes FC' },
        { ...teamFields, id: otherTeamId, name: 'Costa FC' },
      ]),
    );
    await players.save(
      players.create({
        ...fields,
        id: playerId,
        createdAt: new Date('2020-01-01'),
        updatedAt: new Date('2020-01-01'),
      }),
    );
  });

  afterAll(async () => {
    await application.close();
  });

  it.each([
    ['get', '/api/players'],
    ['get', `/api/players/${playerId}`],
    ['post', '/api/players'],
    ['patch', `/api/players/${playerId}`],
    ['delete', `/api/players/${playerId}`],
  ] as const)('%s %s rejects missing sessions', async (method, path) => {
    await request(server)[method](path).send(fields).expect(401);
  });

  it.each(['post', 'patch', 'delete'] as const)(
    '%s rejects regular users without changes',
    async (method) => {
      const path = method === 'post' ? '/api/players' : `/api/players/${playerId}`;
      await request(server)
        [method](path)
        .auth(token(regularId), { type: 'bearer' })
        .send({ ...fields, goals: 99 })
        .expect(403);
      expect(await players.count()).toBe(1);
      expect((await players.findOneByOrFail({ id: playerId })).goals).toBe(3);
    },
  );

  it('rejects invalid or expired tokens and deleted accounts', async () => {
    const expired = jwt.sign({ sub: adminId }, { expiresIn: -1 });
    for (const value of ['invalid', expired, token(randomUUID())]) {
      await request(server).get('/api/players').auth(value, { type: 'bearer' }).expect(401);
    }
  });

  it('uses the current database role instead of trusting a stale token', async () => {
    const existingToken = token();
    await users.update(adminId, { role: 'user' });
    await request(server)
      .post('/api/players')
      .auth(existingToken, { type: 'bearer' })
      .send(fields)
      .expect(403);
    await request(server).get('/api/players').auth(existingToken, { type: 'bearer' }).expect(200);
  });

  it('returns database-backed reads with exactly nine fields and ISO timestamps', async () => {
    await players.update(playerId, { goals: 7 });
    const list = await request(server)
      .get('/api/players')
      .auth(token(regularId), { type: 'bearer' })
      .expect(200);
    const profiles = list.body as PlayerResponseDTO[];
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.goals).toBe(7);
    const single = await request(server)
      .get(`/api/players/${playerId}`)
      .auth(token(regularId), { type: 'bearer' })
      .expect(200);
    const player = single.body as PlayerResponseDTO;
    expect(Object.keys(player).sort()).toEqual([...publicKeys].sort());
    expect(player.teamId).toBe(teamId);
    expect(player.createdAt).toMatch(/Z$/);
    expect(player.updatedAt).toMatch(/Z$/);
  });

  it('returns an empty list without players', async () => {
    await players.clear();
    await request(server)
      .get('/api/players')
      .auth(token(regularId), { type: 'bearer' })
      .expect(200)
      .expect([]);
  });

  it('creates with 201, trims text and persists only a team ID', async () => {
    const response = await request(server)
      .post('/api/players')
      .auth(token(), { type: 'bearer' })
      .send({
        ...fields,
        name: ' New Player ',
        position: ' Midfielder ',
        status: ' active ',
        goals: 0,
        assists: 0,
      })
      .expect(201);
    const player = response.body as PlayerResponseDTO;
    expect(player).toMatchObject({
      name: 'New Player',
      position: 'Midfielder',
      status: 'active',
      teamId,
      goals: 0,
      assists: 0,
    });
    expect(Object.keys(player).sort()).toEqual([...publicKeys].sort());
    expect(player.id).toMatch(/^[a-f0-9-]{36}$/);
    const persisted = await players.findOneOrFail({
      where: { id: player.id },
      relations: { team: true },
    });
    expect(persisted.team?.id).toBe(teamId);
  });

  it.each(['active', 'injured', 'suspended', 'free-agent'] as const)(
    'accepts approved status %s with a nullable team',
    async (status) => {
      const response = await request(server)
        .post('/api/players')
        .auth(token(), { type: 'bearer' })
        .send({ ...fields, teamId: null, status })
        .expect(201);
      const player = response.body as PlayerResponseDTO;
      expect(player).toMatchObject({ teamId: null, status });
      expect((await players.findOneByOrFail({ id: player.id })).teamId).toBeNull();
    },
  );

  it('accepts the largest safe integer statistic without losing precision', async () => {
    await request(server)
      .post('/api/players')
      .auth(token(), { type: 'bearer' })
      .send({ ...fields, goals: Number.MAX_SAFE_INTEGER })
      .expect(201);
  });

  it('updates with 200, preserves omitted fields and keeps createdAt', async () => {
    const before = await players.findOneByOrFail({ id: playerId });
    const response = await request(server)
      .patch(`/api/players/${playerId}`)
      .auth(token(), { type: 'bearer' })
      .send({ name: ' Updated Player ', position: ' Defender ', goals: 0 })
      .expect(200);
    const player = response.body as PlayerResponseDTO;
    expect(player).toMatchObject({
      name: 'Updated Player',
      position: 'Defender',
      goals: 0,
      assists: 2,
      teamId,
      status: 'active',
      createdAt: before.createdAt.toISOString(),
    });
    expect(Object.keys(player).sort()).toEqual([...publicKeys].sort());
    expect(new Date(player.updatedAt).getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it('reassigns, unassigns and reassigns a player without rewriting statistics or status', async () => {
    for (const selectedTeam of [otherTeamId, null, teamId]) {
      const response = await request(server)
        .patch(`/api/players/${playerId}`)
        .auth(token(), { type: 'bearer' })
        .send({ teamId: selectedTeam })
        .expect(200);
      expect(response.body).toMatchObject({
        teamId: selectedTeam,
        goals: 3,
        assists: 2,
        status: 'active',
      });
      expect((await players.findOneByOrFail({ id: playerId })).teamId).toBe(selectedTeam);
    }
  });

  // JSON no representa NaN/Infinity; sus valores reales se verifican en unitarias.
  it.each([
    ['empty payload', {}],
    [
      'missing teamId',
      { name: 'New', position: 'Forward', status: 'active', goals: 0, assists: 0 },
    ],
    ['blank name', { ...fields, name: '  ' }],
    ['object name', { ...fields, name: {} }],
    ['blank position', { ...fields, position: '\t' }],
    ['numeric position', { ...fields, position: 10 }],
    ['unknown status', { ...fields, status: 'retired' }],
    ['uppercase status', { ...fields, status: 'ACTIVE' }],
    ['negative goals', { ...fields, goals: -1 }],
    ['fractional assists', { ...fields, assists: 0.5 }],
    ['string statistic', { ...fields, goals: '3' }],
    ['boolean statistic', { ...fields, assists: true }],
    ['null statistic', { ...fields, goals: null }],
    ['unsafe statistic', { ...fields, assists: Number.MAX_SAFE_INTEGER + 1 }],
    ['invalid team ID', { ...fields, teamId: 'unknown' }],
    ['unknown team UUID', { ...fields, teamId: randomUUID() }],
    ['embedded teamId', { ...fields, teamId: { id: teamId } }],
    ['embedded team', { ...fields, team: { id: teamId } }],
    ['client ID', { ...fields, id: randomUUID() }],
    ['client timestamp', { ...fields, createdAt: '2020-01-01' }],
  ])('rejects %s on create without writing', async (_description, payload) => {
    await request(server)
      .post('/api/players')
      .auth(token(), { type: 'bearer' })
      .send(payload)
      .expect(400);
    expect(await players.count()).toBe(1);
  });

  it.each([
    {},
    { name: null },
    { position: null },
    { status: null },
    { goals: null },
    { assists: null },
    { status: 'retired' },
    { goals: -1 },
    { assists: 0.5 },
    { goals: '3' },
    { teamId: '' },
    { teamId: { id: teamId } },
    { team: { id: teamId } },
    { teamId: randomUUID(), name: 'Must Not Change', goals: 99 },
    { updatedAt: '2020-01-01' },
    { name: ' ' },
  ])('rejects invalid update %# without partial mutation', async (payload) => {
    const before = await players.findOneByOrFail({ id: playerId });
    await request(server)
      .patch(`/api/players/${playerId}`)
      .auth(token(), { type: 'bearer' })
      .send(payload)
      .expect(400);
    expect(await players.findOneByOrFail({ id: playerId })).toEqual(before);
  });

  it.each(['get', 'patch', 'delete'] as const)(
    '%s returns 404 for a missing player',
    async (method) => {
      await request(server)
        [method](`/api/players/${randomUUID()}`)
        .auth(token(), { type: 'bearer' })
        .send({ goals: 0 })
        .expect(404);
    },
  );

  it.each(['get', 'patch', 'delete'] as const)(
    '%s rejects malformed player IDs',
    async (method) => {
      await request(server)
        [method]('/api/players/not-a-uuid')
        .auth(token(), { type: 'bearer' })
        .send({ goals: 0 })
        .expect(400);
    },
  );

  it('deletes with 204 while preserving both teams and other players', async () => {
    const other = await players.save(players.create({ ...fields, teamId: null }));
    const response = await request(server)
      .delete(`/api/players/${playerId}`)
      .auth(token(), { type: 'bearer' })
      .expect(204);
    expect(response.text).toBe('');
    expect(await players.existsBy({ id: playerId })).toBe(false);
    expect(await players.existsBy({ id: other.id })).toBe(true);
    expect(await teams.count()).toBe(2);
  });

  it('reflects team deletion as null in the public player contract', async () => {
    await request(server)
      .delete(`/api/teams/${teamId}`)
      .auth(token(), { type: 'bearer' })
      .expect(204);
    const response = await request(server)
      .get(`/api/players/${playerId}`)
      .auth(token(regularId), { type: 'bearer' })
      .expect(200);
    expect(response.body).toMatchObject({ teamId: null, goals: 3, assists: 2, status: 'active' });
    expect(Object.keys(response.body as PlayerResponseDTO).sort()).toEqual([...publicKeys].sort());
  });

  it('coordinates concurrent player creation and team deletion without dangling references', async () => {
    const results = await Promise.all([
      request(server).post('/api/players').auth(token(), { type: 'bearer' }).send(fields),
      request(server).delete(`/api/teams/${teamId}`).auth(token(), { type: 'bearer' }),
    ]);
    expect([201, 400]).toContain(results[0]?.status);
    expect(results[1]?.status).toBe(204);
    expect(await players.countBy({ teamId })).toBe(0);
    expect(await dataSource.query('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('rolls back a failed update and keeps a generic server error response', async () => {
    const before = await players.findOneByOrFail({ id: playerId });
    await dataSource.query(
      `CREATE TRIGGER test_block_player_update BEFORE UPDATE ON players BEGIN SELECT RAISE(ABORT, 'Private database detail'); END`,
    );
    try {
      const response = await request(server)
        .patch(`/api/players/${playerId}`)
        .auth(token(), { type: 'bearer' })
        .send({ goals: 99 })
        .expect(500);
      expect((response.body as ApiErrorResponseDTO).message).toEqual(['Internal server error.']);
      expect(JSON.stringify(response.body)).not.toContain('Private database detail');
      expect(await players.findOneByOrFail({ id: playerId })).toEqual(before);
    } finally {
      await dataSource.query('DROP TRIGGER test_block_player_update');
    }
  });

  it('uses the shared error envelope for unknown teams without echoing input', async () => {
    const response = await request(server)
      .post('/api/players')
      .auth(token(), { type: 'bearer' })
      .send({ ...fields, teamId: randomUUID() })
      .expect(400);
    const error = response.body as ApiErrorResponseDTO;
    expect(error).toMatchObject({
      statusCode: 400,
      path: '/api/players',
      message: ['Select an existing team or leave the player unassigned.'],
    });
    expect(error.timestamp).toMatch(/Z$/);
    expect(JSON.stringify(error)).not.toMatch(/SQL|stack|passwordHash/);
  });
});
