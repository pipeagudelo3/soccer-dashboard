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
import type { MatchStatsResponseDTO } from '../src/match-stats/dto/match-stats-response.dto.js';
import { MatchStats } from '../src/match-stats/entities/match-stats.entity.js';
import { Team } from '../src/teams/entities/team.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { PasswordService } from '../src/users/password.service.js';

// Ejercita contratos HTTP y relaciones reales sin reemplazar guards o repositorios.
describe('MatchStats REST API (e2e)', () => {
  let application: INestApplication;
  let server: Server;
  let dataSource: DataSource;
  let matches: Repository<MatchStats>;
  let teams: Repository<Team>;
  let users: Repository<User>;
  let passwordHash: string;
  const adminId = randomUUID();
  const regularId = randomUUID();
  const matchId = randomUUID();
  const homeTeamId = randomUUID();
  const awayTeamId = randomUUID();
  const thirdTeamId = randomUUID();
  const fields = {
    date: '2024-02-29',
    homeTeamId,
    awayTeamId,
    goalsHomeTeam: 2,
    goalsAwayTeam: 1,
    stadium: 'Demo Stadium',
    attendance: 100,
  };
  const publicKeys = [
    'id',
    'date',
    'homeTeamId',
    'awayTeamId',
    'goalsHomeTeam',
    'goalsAwayTeam',
    'stadium',
    'attendance',
    'createdAt',
    'updatedAt',
  ];
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });

  // La prueba firma sesiones ficticias; la emisión HTTP de JWT sigue pendiente de #47.
  function token(id = adminId): string {
    return jwt.sign({ sub: id }, { algorithm: 'HS256', expiresIn: '15m' });
  }

  beforeAll(async () => {
    application = await createApplication();
    await application.init();
    server = application.getHttpServer() as Server;
    dataSource = application.get(DataSource);
    matches = dataSource.getRepository(MatchStats);
    teams = dataSource.getRepository(Team);
    users = dataSource.getRepository(User);
    passwordHash = await application.get(PasswordService).hashPassword('MatchFixture123');
  });

  beforeEach(async () => {
    await matches.clear();
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
        { ...teamFields, id: homeTeamId, name: 'Andes FC' },
        { ...teamFields, id: awayTeamId, name: 'Costa FC' },
        { ...teamFields, id: thirdTeamId, name: 'Valle FC' },
      ]),
    );
    await matches.save(
      matches.create({
        ...fields,
        id: matchId,
        createdAt: new Date('2020-01-01'),
        updatedAt: new Date('2020-01-01'),
      }),
    );
  });

  afterAll(async () => {
    await application.close();
  });

  it.each([
    ['get', '/api/match-stats'],
    ['get', `/api/match-stats/${matchId}`],
    ['post', '/api/match-stats'],
    ['patch', `/api/match-stats/${matchId}`],
    ['delete', `/api/match-stats/${matchId}`],
  ] as const)('%s %s rejects missing sessions', async (method, path) => {
    await request(server)[method](path).send(fields).expect(401);
  });

  it.each(['post', 'patch', 'delete'] as const)(
    '%s rejects a regular user without changing data',
    async (method) => {
      const path = method === 'post' ? '/api/match-stats' : `/api/match-stats/${matchId}`;
      await request(server)
        [method](path)
        .auth(token(regularId), { type: 'bearer' })
        .send({ ...fields, goalsHomeTeam: 99 })
        .expect(403);
      expect(await matches.count()).toBe(1);
      expect((await matches.findOneByOrFail({ id: matchId })).goalsHomeTeam).toBe(2);
    },
  );

  it('rejects invalid sessions and applies the current role', async () => {
    await request(server).get('/api/match-stats').auth('invalid', { type: 'bearer' }).expect(401);
    await request(server)
      .get('/api/match-stats')
      .auth(token(randomUUID()), { type: 'bearer' })
      .expect(401);
    const existingToken = token();
    await users.update(adminId, { role: 'user' });
    await request(server)
      .post('/api/match-stats')
      .auth(existingToken, { type: 'bearer' })
      .send(fields)
      .expect(403);
  });

  it('returns database data with IDs and exactly ten public properties', async () => {
    await matches.update(matchId, { attendance: 250 });
    const list = await request(server)
      .get('/api/match-stats')
      .auth(token(regularId), { type: 'bearer' })
      .expect(200);
    expect((list.body as MatchStatsResponseDTO[])[0]?.attendance).toBe(250);
    const single = await request(server)
      .get(`/api/match-stats/${matchId}`)
      .auth(token(regularId), { type: 'bearer' })
      .expect(200);
    const matchStats = single.body as MatchStatsResponseDTO;
    expect(Object.keys(matchStats).sort()).toEqual([...publicKeys].sort());
    expect(matchStats).toMatchObject({ homeTeamId, awayTeamId, date: fields.date });
    expect(matchStats.createdAt).toMatch(/Z$/);
    expect(matchStats.updatedAt).toMatch(/Z$/);
  });

  it('returns an empty list without records', async () => {
    await matches.clear();
    await request(server)
      .get('/api/match-stats')
      .auth(token(regularId), { type: 'bearer' })
      .expect(200)
      .expect([]);
  });

  it('creates with 201, trims date/stadium and persists both team relationships', async () => {
    const response = await request(server)
      .post('/api/match-stats')
      .auth(token(), { type: 'bearer' })
      .send({
        ...fields,
        date: ' 2024-03-01 ',
        stadium: ' New Stadium ',
        goalsHomeTeam: 0,
        goalsAwayTeam: 0,
        attendance: 0,
      })
      .expect(201);
    const matchStats = response.body as MatchStatsResponseDTO;
    expect(matchStats).toMatchObject({
      date: '2024-03-01',
      stadium: 'New Stadium',
      goalsHomeTeam: 0,
      goalsAwayTeam: 0,
      attendance: 0,
    });
    expect(Object.keys(matchStats).sort()).toEqual([...publicKeys].sort());
    const saved = await matches.findOneOrFail({
      where: { id: matchStats.id },
      relations: { homeTeam: true, awayTeam: true },
    });
    expect(saved.homeTeam.id).toBe(homeTeamId);
    expect(saved.awayTeam.id).toBe(awayTeamId);
  });

  it('accepts today in UTC and the largest safe integer attendance', async () => {
    await request(server)
      .post('/api/match-stats')
      .auth(token(), { type: 'bearer' })
      .send({
        ...fields,
        date: new Date().toISOString().slice(0, 10),
        attendance: Number.MAX_SAFE_INTEGER,
      })
      .expect(201);
  });

  it('updates with 200 without losing omitted fields or createdAt', async () => {
    const before = await matches.findOneByOrFail({ id: matchId });
    const response = await request(server)
      .patch(`/api/match-stats/${matchId}`)
      .auth(token(), { type: 'bearer' })
      .send({ goalsHomeTeam: 0, stadium: ' Updated Stadium ' })
      .expect(200);
    const matchStats = response.body as MatchStatsResponseDTO;
    expect(matchStats).toMatchObject({
      ...fields,
      goalsHomeTeam: 0,
      stadium: 'Updated Stadium',
      createdAt: before.createdAt.toISOString(),
    });
    expect(new Date(matchStats.updatedAt).getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it('changes teams using IDs and allows retaining the current unique key', async () => {
    await request(server)
      .patch(`/api/match-stats/${matchId}`)
      .auth(token(), { type: 'bearer' })
      .send({ date: fields.date, homeTeamId, awayTeamId })
      .expect(200);
    await request(server)
      .patch(`/api/match-stats/${matchId}`)
      .auth(token(), { type: 'bearer' })
      .send({ awayTeamId: thirdTeamId })
      .expect(200);
    expect((await matches.findOneByOrFail({ id: matchId })).awayTeamId).toBe(thirdTeamId);
  });

  it('rejects an exact duplicate with 409 even if scores or stadium differ', async () => {
    await request(server)
      .post('/api/match-stats')
      .auth(token(), { type: 'bearer' })
      .send({ ...fields, date: ' 2024-02-29 ', goalsHomeTeam: 9, stadium: 'Other Stadium' })
      .expect(409);
    expect(await matches.count()).toBe(1);
  });

  it('rejects a duplicate changed key on PATCH without partial mutation', async () => {
    const other = await matches.save(matches.create({ ...fields, date: '2024-03-01' }));
    await request(server)
      .patch(`/api/match-stats/${other.id}`)
      .auth(token(), { type: 'bearer' })
      .send({ date: fields.date, attendance: 999 })
      .expect(409);
    expect(await matches.findOneByOrFail({ id: other.id })).toEqual(other);
  });

  it('allows the reversed team pair or another date', async () => {
    for (const payload of [
      { ...fields, homeTeamId: awayTeamId, awayTeamId: homeTeamId },
      { ...fields, date: '2024-03-01' },
    ]) {
      await request(server)
        .post('/api/match-stats')
        .auth(token(), { type: 'bearer' })
        .send(payload)
        .expect(201);
    }
    expect(await matches.count()).toBe(3);
  });

  // JSON no representa NaN/Infinity: esos valores se prueban directamente en unitarias.
  it.each([
    ['empty payload', {}],
    ['equal teams', { ...fields, awayTeamId: homeTeamId }],
    ['missing home team', { ...fields, homeTeamId: randomUUID() }],
    ['missing away team', { ...fields, awayTeamId: randomUUID() }],
    ['invalid team ID', { ...fields, homeTeamId: 'unknown' }],
    ['null team', { ...fields, awayTeamId: null }],
    ['embedded ID', { ...fields, homeTeamId: { id: homeTeamId } }],
    ['embedded team', { ...fields, homeTeam: { id: homeTeamId } }],
    ['blank stadium', { ...fields, stadium: ' ' }],
    ['object stadium', { ...fields, stadium: {} }],
    ['future date', { ...fields, date: '9999-01-01' }],
    ['non-leap date', { ...fields, date: '2025-02-29' }],
    ['century non-leap date', { ...fields, date: '1900-02-29' }],
    ['impossible date', { ...fields, date: '2025-04-31' }],
    ['invalid format', { ...fields, date: '01/01/2025' }],
    ['timestamp date', { ...fields, date: '2024-02-29T00:00:00Z' }],
    ['zero year', { ...fields, date: '0000-01-01' }],
    ['null date', { ...fields, date: null }],
    ['negative home goals', { ...fields, goalsHomeTeam: -1 }],
    ['fractional away goals', { ...fields, goalsAwayTeam: 0.5 }],
    ['string attendance', { ...fields, attendance: '100' }],
    ['boolean goals', { ...fields, goalsHomeTeam: true }],
    ['null attendance', { ...fields, attendance: null }],
    ['unsafe goals', { ...fields, goalsAwayTeam: Number.MAX_SAFE_INTEGER + 1 }],
    ['client ID', { ...fields, id: randomUUID() }],
    ['client timestamp', { ...fields, updatedAt: '2020-01-01' }],
  ])('rejects %s on POST without insertion', async (_description, payload) => {
    await request(server)
      .post('/api/match-stats')
      .auth(token(), { type: 'bearer' })
      .send(payload)
      .expect(400);
    expect(await matches.count()).toBe(1);
  });

  it.each([
    {},
    { date: null },
    { homeTeamId: null },
    { awayTeamId: null },
    { goalsHomeTeam: null },
    { goalsAwayTeam: null },
    { stadium: null },
    { attendance: null },
    { date: '2025-02-29' },
    { date: '9999-01-01' },
    { stadium: ' ' },
    { goalsHomeTeam: -1 },
    { goalsAwayTeam: 0.5 },
    { attendance: '1' },
    { awayTeamId: homeTeamId },
    { homeTeamId: awayTeamId },
    { homeTeamId: randomUUID(), stadium: 'Must Not Change' },
    { awayTeamId: randomUUID() },
    { awayTeam: { id: awayTeamId } },
    { attendance: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects invalid PATCH %# without partial changes', async (payload) => {
    const before = await matches.findOneByOrFail({ id: matchId });
    await request(server)
      .patch(`/api/match-stats/${matchId}`)
      .auth(token(), { type: 'bearer' })
      .send(payload)
      .expect(400);
    expect(await matches.findOneByOrFail({ id: matchId })).toEqual(before);
  });

  it.each(['get', 'patch', 'delete'] as const)('%s returns 404 for missing IDs', async (method) => {
    await request(server)
      [method](`/api/match-stats/${randomUUID()}`)
      .auth(token(), { type: 'bearer' })
      .send({ attendance: 0 })
      .expect(404);
  });

  it.each(['get', 'patch', 'delete'] as const)('%s rejects malformed IDs', async (method) => {
    await request(server)
      [method]('/api/match-stats/not-a-uuid')
      .auth(token(), { type: 'bearer' })
      .send({ attendance: 0 })
      .expect(400);
  });

  it.each([homeTeamId, awayTeamId])(
    'blocks deleting referenced team %s until the match is removed',
    async (teamId) => {
      await request(server)
        .delete(`/api/teams/${teamId}`)
        .auth(token(), { type: 'bearer' })
        .expect(409);
      const response = await request(server)
        .delete(`/api/match-stats/${matchId}`)
        .auth(token(), { type: 'bearer' })
        .expect(204);
      expect(response.text).toBe('');
      expect(await teams.count()).toBe(3);
      await request(server)
        .delete(`/api/teams/${teamId}`)
        .auth(token(), { type: 'bearer' })
        .expect(204);
    },
  );

  it('admits only one of two concurrent duplicate creations', async () => {
    const results = await Promise.all(
      [1, 2].map(() =>
        request(server)
          .post('/api/match-stats')
          .auth(token(), { type: 'bearer' })
          .send({ ...fields, date: '2024-03-01' }),
      ),
    );
    expect(results.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await matches.count()).toBe(2);
  });

  it('coordinates team deletion and match creation without dangling references', async () => {
    await matches.clear();
    const results = await Promise.all([
      request(server).post('/api/match-stats').auth(token(), { type: 'bearer' }).send(fields),
      request(server).delete(`/api/teams/${homeTeamId}`).auth(token(), { type: 'bearer' }),
    ]);
    expect([
      [201, 409],
      [400, 204],
    ]).toContainEqual(results.map((response) => response.status));
    expect(await dataSource.query('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('rolls back unexpected SQLite update failures with a generic response', async () => {
    const before = await matches.findOneByOrFail({ id: matchId });
    await dataSource.query(
      `CREATE TRIGGER test_block_match_update BEFORE UPDATE ON match_stats BEGIN SELECT RAISE(ABORT, 'Private database detail'); END`,
    );
    try {
      const response = await request(server)
        .patch(`/api/match-stats/${matchId}`)
        .auth(token(), { type: 'bearer' })
        .send({ attendance: 999 })
        .expect(500);
      expect((response.body as ApiErrorResponseDTO).message).toEqual(['Internal server error.']);
      expect(JSON.stringify(response.body)).not.toContain('Private database detail');
      expect(await matches.findOneByOrFail({ id: matchId })).toEqual(before);
    } finally {
      await dataSource.query('DROP TRIGGER test_block_match_update');
    }
  });

  it('returns the shared safe error envelope', async () => {
    const response = await request(server)
      .get(`/api/match-stats/${randomUUID()}`)
      .auth(token(), { type: 'bearer' })
      .expect(404);
    const error = response.body as ApiErrorResponseDTO;
    expect(error).toMatchObject({ statusCode: 404, message: ['Match statistics not found.'] });
    expect(error.path).toMatch(/^\/api\/match-stats\//);
    expect(error.timestamp).toMatch(/Z$/);
    expect(JSON.stringify(error)).not.toMatch(/SQL|stack|passwordHash/);
  });
});
