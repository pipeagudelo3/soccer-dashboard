import './test-environment.js';

import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { DataSource } from 'typeorm';
import type { Repository } from 'typeorm';

import type { ApiErrorResponseDTO } from '../src/common/dto/api-error-response.dto.js';
import { UsersService } from '../src/users/users.service.js';
import { createApplication } from '../src/create-application.js';
import type { UserResponseDTO } from '../src/users/dto/user-response.dto.js';
import { User } from '../src/users/entities/user.entity.js';
import { PasswordService } from '../src/users/password.service.js';

// Usa HTTP real, JWT firmados y SQLite aislado; no reemplaza guards ni repositorios.
describe('Users REST API (e2e)', () => {
  let application: INestApplication;
  let server: Server;
  let repository: Repository<User>;
  let passwordService: PasswordService;
  let passwordHash: string;
  const adminId = randomUUID();
  const secondAdminId = randomUUID();
  const regularId = randomUUID();
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const newUser = {
    name: 'New User',
    email: 'new@soccer.example',
    password: 'NewPassword123',
    role: 'user',
  };

  // Los tokens de prueba se firman solo aquí. El login público se implementará en #47.
  function token(id = adminId): string {
    return jwt.sign({ sub: id }, { algorithm: 'HS256', expiresIn: '15m' });
  }

  async function selectedHash(id: string): Promise<string> {
    const user = await repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOneOrFail();
    return user.passwordHash;
  }

  beforeAll(async () => {
    application = await createApplication();
    await application.init();
    server = application.getHttpServer() as Server;
    repository = application.get(DataSource).getRepository(User);
    passwordService = application.get(PasswordService);
    passwordHash = await passwordService.hashPassword('FixturePassword123');
  });

  beforeEach(async () => {
    // Cada escenario comienza con dos admins y un usuario regular independientes.
    await repository.clear();
    await repository.save(
      repository.create([
        {
          id: adminId,
          name: 'First Admin',
          email: 'admin@soccer.example',
          role: 'admin',
          passwordHash,
        },
        {
          id: secondAdminId,
          name: 'Second Admin',
          email: 'second@soccer.example',
          role: 'admin',
          passwordHash,
        },
        {
          id: regularId,
          name: 'Regular User',
          email: 'regular@soccer.example',
          role: 'user',
          passwordHash,
        },
      ]),
    );
  });

  afterAll(async () => {
    await application.close();
  });

  // Comprueba TODOS los métodos: permisos antes de validación y consulta del recurso.
  it.each(['get', 'post', 'patch', 'delete'] as const)(
    '%s rejects unauthenticated callers',
    async (method) => {
      const path = method === 'get' || method === 'post' ? '/api/users' : `/api/users/${regularId}`;
      await request(server)[method](path).send(newUser).expect(401);
    },
  );

  it.each(['get', 'post', 'patch', 'delete'] as const)(
    '%s rejects regular users',
    async (method) => {
      const path = method === 'get' || method === 'post' ? '/api/users' : `/api/users/${regularId}`;
      await request(server)
        [method](path)
        .auth(token(regularId), { type: 'bearer' })
        .send(newUser)
        .expect(403);
    },
  );

  it('does not allow a regular user to read their own user resource', async () => {
    await request(server)
      .get(`/api/users/${regularId}`)
      .auth(token(regularId), { type: 'bearer' })
      .expect(403);
  });

  it.each([
    'expired',
    'invalid',
    'wrong-secret',
    'no-expiration',
    'wrong-algorithm',
    'bad-subject',
    'future-issued',
  ] as const)('rejects a %s token', async (kind) => {
    const variants = {
      expired: jwt.sign({ sub: adminId }, { expiresIn: -1 }),
      invalid: 'not-a-jwt',
      'wrong-secret': new JwtService({ secret: 'different-test-secret-at-least-32-bytes' }).sign(
        { sub: adminId },
        { expiresIn: '15m' },
      ),
      'no-expiration': jwt.sign({ sub: adminId }),
      'wrong-algorithm': jwt.sign({ sub: adminId }, { algorithm: 'HS384', expiresIn: '15m' }),
      'bad-subject': jwt.sign({ sub: 'not-a-uuid' }, { expiresIn: '15m' }),
      'future-issued': jwt.sign(
        { sub: adminId, iat: Math.floor(Date.now() / 1000) + 3600 },
        { expiresIn: '15m' },
      ),
    };
    await request(server).get('/api/users').auth(variants[kind], { type: 'bearer' }).expect(401);
  });

  it('ignores an administrator role claim forged by a regular account', async () => {
    const forgedRole = jwt.sign({ sub: regularId, role: 'admin' }, { expiresIn: '15m' });
    await request(server).get('/api/users').auth(forgedRole, { type: 'bearer' }).expect(403);
  });

  it('rejects a correctly signed token for a deleted or unknown user', async () => {
    await request(server)
      .get('/api/users')
      .auth(token(randomUUID()), { type: 'bearer' })
      .expect(401);
  });

  // Verifica códigos, lista sin paginación, orden estable y ausencia de secretos.
  it('lists public profiles and gets one profile without exposing hashes', async () => {
    const response = await request(server)
      .get('/api/users')
      .auth(token(), { type: 'bearer' })
      .expect(200);
    const profiles = response.body as UserResponseDTO[];
    expect(profiles).toHaveLength(3);
    const expected = await repository.find({ order: { createdAt: 'ASC', id: 'ASC' } });
    expect(profiles.map((user) => user.id)).toEqual(expected.map((user) => user.id));
    expect(JSON.stringify(profiles)).not.toMatch(/password|\$2[ab]\$/);
    const profile = await request(server)
      .get(`/api/users/${adminId}`)
      .auth(token(), { type: 'bearer' })
      .expect(200);
    expect(profile.body).toMatchObject({ id: adminId, role: 'admin' });
    expect(Object.keys(profile.body as UserResponseDTO).sort()).toEqual([
      'createdAt',
      'email',
      'id',
      'name',
      'role',
      'updatedAt',
    ]);
  });

  it('creates a normalized user and hashes the supplied password', async () => {
    const response = await request(server)
      .post('/api/users')
      .auth(token(), { type: 'bearer' })
      .send({ ...newUser, name: '  New User  ', email: ' NEW@SOCCER.EXAMPLE ' })
      .expect(201);
    const profile = response.body as UserResponseDTO;
    expect(profile).toMatchObject({ name: 'New User', email: 'new@soccer.example', role: 'user' });
    expect(profile.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(profile.createdAt).toMatch(/Z$/);
    expect(JSON.stringify(profile)).not.toContain('password');
    const hash = await selectedHash(profile.id);
    expect(hash).not.toBe(newUser.password);
    expect(await passwordService.verifyPassword(newUser.password, hash)).toBe(true);
    expect((await repository.findOneByOrFail({ id: profile.id })).passwordHash).toBeUndefined();
  });

  it('allows an administrator to create another administrator', async () => {
    const response = await request(server)
      .post('/api/users')
      .auth(token(), { type: 'bearer' })
      .send({ ...newUser, role: 'admin' })
      .expect(201);
    expect(response.body).toMatchObject({ role: 'admin' });
  });

  it('rejects duplicate email on create and update, ignoring case and spaces', async () => {
    await request(server)
      .post('/api/users')
      .auth(token(), { type: 'bearer' })
      .send({ ...newUser, email: ' ADMIN@SOCCER.EXAMPLE ' })
      .expect(409);
    await request(server)
      .patch(`/api/users/${regularId}`)
      .auth(token(), { type: 'bearer' })
      .send({ email: ' ADMIN@SOCCER.EXAMPLE ' })
      .expect(409);
    expect((await repository.findOneByOrFail({ id: regularId })).email).toBe(
      'regular@soccer.example',
    );
  });

  it('updates an existing email to its normalized equivalent without a false conflict', async () => {
    await request(server)
      .patch(`/api/users/${regularId}`)
      .auth(token(), { type: 'bearer' })
      .send({ email: ' REGULAR@SOCCER.EXAMPLE ' })
      .expect(200);
  });

  it('updates fields without changing an omitted password and promotes a user', async () => {
    const response = await request(server)
      .patch(`/api/users/${regularId}`)
      .auth(token(), { type: 'bearer' })
      .send({ name: '  Updated User  ', role: 'admin' })
      .expect(200);
    expect(response.body).toMatchObject({ name: 'Updated User', role: 'admin' });
    expect(await selectedHash(regularId)).toBe(passwordHash);
    expect(JSON.stringify(response.body as unknown)).not.toContain('password');
  });

  it('replaces only the password hash when a new password is supplied', async () => {
    const password = ' ChangedPassword123 ';
    await request(server)
      .patch(`/api/users/${regularId}`)
      .auth(token(), { type: 'bearer' })
      .send({ password })
      .expect(200);
    const hash = await selectedHash(regularId);
    expect(hash).not.toBe(passwordHash);
    expect(await passwordService.verifyPassword(password, hash)).toBe(true);
    expect(await passwordService.verifyPassword(password.trim(), hash)).toBe(false);
  });

  // Los casos inválidos no dependen del frontend y nunca devuelven valores sensibles.
  it.each([
    ['missing fields', {}],
    ['blank name', { ...newUser, name: '  ' }],
    ['invalid name type', { ...newUser, name: 12 }],
    ['invalid email', { ...newUser, email: 'bad-email' }],
    ['unknown role', { ...newUser, role: 'superadmin' }],
    ['null role', { ...newUser, role: null }],
    ['short password', { ...newUser, password: 'Ab1' }],
    ['no uppercase', { ...newUser, password: 'password123' }],
    ['no lowercase', { ...newUser, password: 'PASSWORD123' }],
    ['no number', { ...newUser, password: 'PasswordOnly' }],
    ['too many bytes', { ...newUser, password: 'Aa1' + 'é'.repeat(35) }],
    ['forbidden hash', { ...newUser, passwordHash: 'never-accept-client-hashes' }],
    ['forbidden id', { ...newUser, id: randomUUID() }],
    ['forbidden timestamp', { ...newUser, createdAt: new Date().toISOString() }],
  ])('rejects create payload with %s', async (_description, payload) => {
    const response = await request(server)
      .post('/api/users')
      .auth(token(), { type: 'bearer' })
      .send(payload)
      .expect(400);
    expect(JSON.stringify(response.body as unknown)).not.toContain(newUser.password);
    expect(await repository.count()).toBe(3);
  });

  it.each([
    {},
    { name: null },
    { email: null },
    { role: null },
    { password: null },
    { password: '' },
    { role: 'owner' },
    { name: ' ' },
    { id: randomUUID() },
  ])('rejects empty, null or invalid PATCH %#', async (payload) => {
    await request(server)
      .patch(`/api/users/${regularId}`)
      .auth(token(), { type: 'bearer' })
      .send(payload)
      .expect(400);
    expect(await selectedHash(regularId)).toBe(passwordHash);
  });

  it.each(['get', 'patch', 'delete'] as const)(
    '%s returns 404 for a missing UUID',
    async (method) => {
      await request(server)
        [method](`/api/users/${randomUUID()}`)
        .auth(token(), { type: 'bearer' })
        .send({ name: 'Updated' })
        .expect(404);
    },
  );

  it.each(['get', 'patch', 'delete'] as const)(
    '%s returns 400 for a malformed UUID',
    async (method) => {
      await request(server)
        [method]('/api/users/not-a-uuid')
        .auth(token(), { type: 'bearer' })
        .send({ name: 'Updated' })
        .expect(400);
    },
  );

  // Revisa tanto cambios propios como ajenos y la protección atómica del último admin.
  it('deletes a regular account with 204 and an empty body', async () => {
    const response = await request(server)
      .delete(`/api/users/${regularId}`)
      .auth(token(), { type: 'bearer' })
      .expect(204);
    expect(response.text).toBe('');
    expect(await repository.existsBy({ id: regularId })).toBe(false);
  });

  it('blocks deleting or demoting the last administrator without partial changes', async () => {
    await repository.delete(secondAdminId);
    await request(server)
      .patch(`/api/users/${adminId}`)
      .auth(token(), { type: 'bearer' })
      .send({ role: 'user', name: 'Must Not Change', password: 'DifferentPassword123' })
      .expect(409);
    await request(server)
      .delete(`/api/users/${adminId}`)
      .auth(token(), { type: 'bearer' })
      .expect(409);
    const admin = await repository.findOneByOrFail({ id: adminId });
    expect(admin.name).toBe('First Admin');
    expect(admin.role).toBe('admin');
    expect(await selectedHash(adminId)).toBe(passwordHash);
  });

  it('permits self-demotion when another admin exists and applies the new role immediately', async () => {
    const session = token();
    await request(server)
      .patch(`/api/users/${adminId}`)
      .auth(session, { type: 'bearer' })
      .send({ role: 'user' })
      .expect(200);
    await request(server).get('/api/users').auth(session, { type: 'bearer' }).expect(403);
    expect(await repository.countBy({ role: 'admin' })).toBe(1);
  });

  it('permits self-deletion when another admin exists and invalidates subsequent requests', async () => {
    const session = token();
    await request(server)
      .delete(`/api/users/${adminId}`)
      .auth(session, { type: 'bearer' })
      .expect(204);
    await request(server).get('/api/users').auth(session, { type: 'bearer' }).expect(401);
    expect(await repository.countBy({ role: 'admin' })).toBe(1);
  });

  it('preserves an administrator under simultaneous deletion and demotion', async () => {
    const results = await Promise.all([
      request(server).delete(`/api/users/${secondAdminId}`).auth(token(), { type: 'bearer' }),
      request(server)
        .patch(`/api/users/${adminId}`)
        .auth(token(), { type: 'bearer' })
        .send({ role: 'user' }),
    ]);
    expect(results.filter((response) => response.status === 409)).toHaveLength(1);
    expect(results.filter((response) => [200, 204].includes(response.status))).toHaveLength(1);
    expect(await repository.countBy({ role: 'admin' })).toBe(1);
  });

  it('allows exactly one of two simultaneous duplicate creates', async () => {
    const results = await Promise.all([
      request(server).post('/api/users').auth(token(), { type: 'bearer' }).send(newUser),
      request(server)
        .post('/api/users')
        .auth(token(), { type: 'bearer' })
        .send({ ...newUser, email: newUser.email.toUpperCase() }),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await repository.countBy({ email: newUser.email })).toBe(1);
  });

  // Inyecta un fallo inesperado para comprobar que el filtro no filtra detalles internos.
  it('returns a safe generic 500 for unexpected failures', async () => {
    const failure = jest
      .spyOn(application.get(UsersService), 'findAll')
      .mockRejectedValueOnce(new Error('private SQL and credentials'));
    try {
      const response = await request(server)
        .get('/api/users')
        .auth(token(), { type: 'bearer' })
        .expect(500);
      expect(response.body).toMatchObject({
        statusCode: 500,
        message: ['Internal server error.'],
        path: '/api/users',
      });
      expect(JSON.stringify(response.body as unknown)).not.toContain('private SQL');
    } finally {
      failure.mockRestore();
    }
  });

  it('uses the documented error envelope and strips the query string', async () => {
    const response = await request(server).get('/api/users?secret=must-not-echo').expect(401);
    const error = response.body as ApiErrorResponseDTO;
    expect(error.statusCode).toBe(401);
    expect(Array.isArray(error.message)).toBe(true);
    expect(error.path).toBe('/api/users');
    expect(error.timestamp).toMatch(/Z$/);
    expect(JSON.stringify(response.body as unknown)).not.toContain('must-not-echo');
  });
});
