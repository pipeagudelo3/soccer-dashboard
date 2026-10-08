import './test-environment.js';

import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import type { Repository } from 'typeorm';

import type { LoginResponseDTO } from '../src/auth/dto/login-response.dto.js';
import { createApplication } from '../src/create-application.js';
import { User } from '../src/users/entities/user.entity.js';
import { PasswordService } from '../src/users/password.service.js';

// Usa HTTP real, bcrypt, firma JWT y SQLite; el frontend no participa en la autorización.
describe('JWT authentication (e2e)', () => {
  let application: INestApplication;
  let server: Server;
  let users: Repository<User>;
  let passwords: PasswordService;
  let passwordHash: string;
  const adminId = randomUUID();
  const regularId = randomUUID();
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const demoPassword = 'AcademicDemo123';

  async function login(
    email = 'admin@soccer.example',
    password = demoPassword,
  ): Promise<LoginResponseDTO> {
    const response = await request(server)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body as LoginResponseDTO;
  }

  beforeAll(async () => {
    application = await createApplication();
    await application.init();
    server = application.getHttpServer() as Server;
    users = application.get(DataSource).getRepository(User);
    passwords = application.get(PasswordService);
    passwordHash = await passwords.hashPassword(demoPassword);
  });

  beforeEach(async () => {
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
  });

  afterAll(async () => {
    await application.close();
  });

  it.each([
    ['admin@soccer.example', adminId, 'admin'],
    ['user@soccer.example', regularId, 'user'],
  ])(
    'authenticates %s and returns a safe profile with a short-lived JWT',
    async (email, id, role) => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({ email, password: demoPassword })
        .expect(200)
        .expect('Cache-Control', 'no-store');
      const session = response.body as LoginResponseDTO;
      expect(session).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: 900,
        user: { id, email, role },
      });
      expect(Object.keys(session.user).sort()).toEqual(
        ['id', 'name', 'email', 'role', 'createdAt', 'updatedAt'].sort(),
      );
      expect(JSON.stringify(session.user)).not.toMatch(/password|hash|secret|token/i);
      const payload = await jwt.verifyAsync<{ sub: string; iat: number; exp: number }>(
        session.accessToken,
        { algorithms: ['HS256'] },
      );
      expect(payload.sub).toBe(id);
      expect(payload.exp - payload.iat).toBe(session.expiresIn);
      expect(Object.keys(payload).sort()).toEqual(['sub', 'iat', 'exp'].sort());
      const me = await request(server)
        .get('/api/auth/me')
        .auth(session.accessToken, { type: 'bearer' })
        .expect(200)
        .expect('Cache-Control', 'no-store');
      expect(me.body).toEqual(session.user);
    },
  );

  it('normalizes uppercase and surrounding whitespace in email', async () => {
    const session = await login(' ADMIN@SOCCER.EXAMPLE ');
    expect(session.user.email).toBe('admin@soccer.example');
  });

  it('returns the same generic 401 for unknown email and wrong password', async () => {
    const known = await request(server)
      .post('/api/auth/login')
      .send({ email: 'admin@soccer.example', password: 'WrongPassword123' })
      .expect(401);
    const unknown = await request(server)
      .post('/api/auth/login')
      .send({ email: 'missing@soccer.example', password: 'WrongPassword123' })
      .expect(401);
    expect(known.body).toMatchObject({
      statusCode: 401,
      message: ['Invalid email or password.'],
      path: '/api/auth/login',
    });
    expect((unknown.body as { message: string[] }).message).toEqual(
      (known.body as { message: string[] }).message,
    );
    expect(JSON.stringify([known.body, unknown.body])).not.toMatch(/passwordHash|stack|SELECT/);
  });

  it('does not trim passwords and rejects long UTF-8 passwords without truncation', async () => {
    for (const password of [` ${demoPassword} `, 'é'.repeat(37)]) {
      await request(server)
        .post('/api/auth/login')
        .send({ email: 'admin@soccer.example', password })
        .expect(401);
    }
  });

  it.each([
    {},
    { email: 'admin@soccer.example' },
    { password: demoPassword },
    { email: 'invalid', password: demoPassword },
    { email: null, password: demoPassword },
    { email: 'admin@soccer.example', password: null },
    { email: 'admin@soccer.example', password: '' },
    { email: 'admin@soccer.example', password: 123 },
    { email: 'admin@soccer.example', password: demoPassword, role: 'admin' },
    { email: 'admin@soccer.example', password: demoPassword, passwordHash: 'unexpected-hash' },
  ])('rejects malformed login DTO %#', async (payload) => {
    await request(server).post('/api/auth/login').send(payload).expect(400);
  });

  it('rejects missing sessions and ignores tokens in URLs and bodies', async () => {
    const session = await login();
    await request(server).get('/api/auth/me').expect(401);
    await request(server).get(`/api/auth/me?token=${session.accessToken}`).expect(401);
    await request(server)
      .get('/api/auth/me')
      .send({ accessToken: session.accessToken })
      .expect(401);
  });

  it('rejects expired, malformed, incorrectly signed and wrong-algorithm JWTs', async () => {
    const tokens = [
      'invalid',
      jwt.sign({ sub: adminId }, { expiresIn: -1 }),
      new JwtService({ secret: 'different-test-secret' }).sign(
        { sub: adminId },
        { expiresIn: '15m' },
      ),
      jwt.sign({ sub: adminId }, { algorithm: 'HS384', expiresIn: '15m' }),
    ];
    for (const value of tokens)
      await request(server).get('/api/auth/me').auth(value, { type: 'bearer' }).expect(401);
  });

  it('rejects missing or invalid signed session claims', async () => {
    const now = Math.floor(Date.now() / 1000);
    const tokens = [
      jwt.sign({ sub: adminId }),
      jwt.sign({ sub: 'invalid' }, { expiresIn: '15m' }),
      jwt.sign({ sub: adminId, iat: now + 100, exp: now + 900 }),
      jwt.sign({ sub: adminId }, { expiresIn: '15m', noTimestamp: true }),
    ];
    for (const value of tokens)
      await request(server).get('/api/auth/me').auth(value, { type: 'bearer' }).expect(401);
  });

  it('allows regular users to read domain data and rejects mutations in all modules', async () => {
    const session = await login('user@soccer.example');
    for (const domain of ['users', 'teams', 'players', 'match-stats']) {
      await request(server)
        .post(`/api/${domain}`)
        .auth(session.accessToken, { type: 'bearer' })
        .send({})
        .expect(403);
      await request(server)
        .get(`/api/${domain}`)
        .auth(session.accessToken, { type: 'bearer' })
        .expect(domain === 'users' ? 403 : 200);
    }
  });

  it('uses an issued administrator token for protected CRUD', async () => {
    const session = await login();
    const created = await request(server)
      .post('/api/users')
      .auth(session.accessToken, { type: 'bearer' })
      .send({ name: 'New Demo', email: 'new@soccer.example', password: 'NewDemo123', role: 'user' })
      .expect(201);
    expect(created.body).not.toHaveProperty('passwordHash');
    expect((await login('new@soccer.example', 'NewDemo123')).user.role).toBe('user');
  });

  it('reflects changed profile and role while keeping the same token', async () => {
    const session = await login();
    await users.update(adminId, {
      role: 'user',
      name: 'Changed Name',
      email: 'changed@soccer.example',
    });
    const me = await request(server)
      .get('/api/auth/me')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(200);
    expect(me.body).toMatchObject({
      role: 'user',
      name: 'Changed Name',
      email: 'changed@soccer.example',
    });
    await request(server)
      .get('/api/users')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(403);
    await request(server)
      .get('/api/teams')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(200);
    await users.update(adminId, { role: 'admin' });
    await request(server)
      .get('/api/users')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(200);
  });

  it('rejects the token after account deletion', async () => {
    const session = await login('user@soccer.example');
    await users.delete(regularId);
    await request(server)
      .get('/api/auth/me')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(401);
    await request(server)
      .get('/api/teams')
      .auth(session.accessToken, { type: 'bearer' })
      .expect(401);
  });

  it('authenticates only the new password after an administrator update', async () => {
    const admin = await login();
    await request(server)
      .patch(`/api/users/${regularId}`)
      .auth(admin.accessToken, { type: 'bearer' })
      .send({ password: 'ChangedDemo123' })
      .expect(200);
    await request(server)
      .post('/api/auth/login')
      .send({ email: 'user@soccer.example', password: demoPassword })
      .expect(401);
    expect((await login('user@soccer.example', 'ChangedDemo123')).user.id).toBe(regularId);
  });

  it('does not log passwords, hashes, secrets or issued tokens on success or rejection', async () => {
    const spies = [
      jest.spyOn(Logger.prototype, 'log'),
      jest.spyOn(Logger.prototype, 'warn'),
      jest.spyOn(Logger.prototype, 'error'),
    ];
    try {
      const session = await login();
      await request(server)
        .post('/api/auth/login')
        .send({ email: 'missing@soccer.example', password: demoPassword })
        .expect(401);
      await request(server)
        .get('/api/auth/me')
        .auth('malformed-token', { type: 'bearer' })
        .expect(401);
      const output = JSON.stringify(spies.map((spy) => spy.mock.calls));
      for (const value of [
        demoPassword,
        passwordHash,
        session.accessToken,
        process.env.JWT_SECRET ?? '',
      ])
        expect(output).not.toContain(value);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
