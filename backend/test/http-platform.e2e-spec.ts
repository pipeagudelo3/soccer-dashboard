import './test-environment.js';

import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';

import { createApplication } from '../src/create-application.js';

interface OpenApiDocument {
  paths: Record<
    string,
    Record<string, { security?: unknown[]; responses: Record<string, unknown> }>
  >;
}

// Rutas que implementa el backend; el documento OpenAPI debe listar exactamente estas.
const publicRoutes = ['GET /api/health', 'POST /api/auth/login'];
const protectedRoutes = [
  'GET /api/auth/me',
  ...['users', 'teams', 'players', 'match-stats'].flatMap((resource) => [
    `GET /api/${resource}`,
    `POST /api/${resource}`,
    `GET /api/${resource}/{id}`,
    `PATCH /api/${resource}/{id}`,
    `DELETE /api/${resource}/{id}`,
  ]),
];

// Verifica la frontera HTTP compartida: validación, errores, CORS, cabeceras, logs y Swagger.
describe('HTTP platform (e2e)', () => {
  const secret = 'Sup3r-Secret-Value-123';
  let application: INestApplication;
  let server: Server;

  beforeAll(async () => {
    application = await createApplication();
    await application.init();
    server = application.getHttpServer() as Server;
  });

  afterAll(async () => {
    await application.close();
  });

  describe('validation and error format', () => {
    it('rejects unknown properties with the common error format', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({ email: 'admin@soccer.example', password: 'AdminDemo123', role: 'admin' })
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        message: ['property role should not exist'],
        path: '/api/auth/login',
        timestamp: expect.any(String) as string,
      });
    });

    it('lists every validation failure without echoing submitted values', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({ email: `not-an-email-${secret}`, password: 123 })
        .expect(400);
      const body = response.body as { message: string[] };

      expect(body.message).toEqual(expect.arrayContaining(['email must be an email']));
      expect(body.message.length).toBeGreaterThan(1);
      expect(JSON.stringify(response.body)).not.toContain(secret);
    });

    it('rejects malformed JSON as a 400 in the common format', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email":')
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        message: [expect.any(String) as string],
        path: '/api/auth/login',
        timestamp: expect.any(String) as string,
      });
    });

    it('rejects oversized JSON bodies with 413 instead of a server error', async () => {
      const response = await request(server)
        .post('/api/auth/login')
        .send({ email: 'admin@soccer.example', password: 'x'.repeat(150_000) })
        .expect(413);

      expect(response.body).toEqual({
        statusCode: 413,
        message: ['request entity too large'],
        path: '/api/auth/login',
        timestamp: expect.any(String) as string,
      });
    });

    it.each([
      ['/api/teams', 401],
      ['/api/unknown', 404],
    ])('uses the common format for GET %s (%i)', async (path, statusCode) => {
      const response = await request(server).get(path);

      expect(response.status).toBe(statusCode);
      expect(Object.keys(response.body as object).sort()).toEqual([
        'message',
        'path',
        'statusCode',
        'timestamp',
      ]);
      expect(JSON.stringify(response.body)).not.toMatch(/stack|at .*\.(ts|js)/);
    });
  });

  describe('CORS and security headers', () => {
    it.each(['http://localhost:5173', 'http://127.0.0.1:5173'])(
      'answers the preflight of the configured origin %s',
      async (origin) => {
        await request(server)
          .options('/api/teams')
          .set('Origin', origin)
          .set('Access-Control-Request-Method', 'GET')
          .expect(204)
          .expect('Access-Control-Allow-Origin', origin);
      },
    );

    it('does not authorize an origin outside the allowlist', async () => {
      const response = await request(server)
        .options('/api/teams')
        .set('Origin', 'https://unapproved.example.com')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('sends Helmet headers and hides the framework', async () => {
      const response = await request(server).get('/api/health').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('structured logging', () => {
    it('logs one request entry without query string, headers or body', async () => {
      const log = jest.spyOn(Logger.prototype, 'log');

      try {
        await request(server)
          .post(`/api/auth/login?token=${secret}`)
          .set('Authorization', `Bearer ${secret}`)
          .send({ email: 'missing@soccer.example', password: secret })
          .expect(401);

        const entries = log.mock.calls.map(([message]) => message as unknown);

        expect(entries).toContainEqual({
          event: 'http_request',
          method: 'POST',
          path: '/api/auth/login',
          statusCode: 401,
          durationMs: expect.any(Number) as number,
        });
        expect(JSON.stringify(entries)).not.toContain(secret);
      } finally {
        log.mockRestore();
      }
    });
  });

  describe('Swagger', () => {
    let document: OpenApiDocument;

    beforeAll(async () => {
      const response = await request(server).get('/api/docs-json').expect(200);
      document = response.body as OpenApiDocument;
    });

    it('serves the interactive UI under /api', async () => {
      await request(server).get('/api/docs').expect(200).expect('Content-Type', /html/);
    });

    it('documents exactly the implemented endpoints', () => {
      const documented = Object.entries(document.paths).flatMap(([path, operations]) =>
        Object.keys(operations).map((method) => `${method.toUpperCase()} ${path}`),
      );

      expect(documented.sort()).toEqual([...publicRoutes, ...protectedRoutes].sort());
    });

    it('requires a bearer token exactly on protected endpoints', () => {
      for (const route of [...publicRoutes, ...protectedRoutes]) {
        const [method = '', path = ''] = route.split(' ');
        const operation = document.paths[path]?.[method.toLowerCase()];

        expect(operation?.security !== undefined).toBe(protectedRoutes.includes(route));
      }
    });

    it('documents the common error response on protected endpoints', () => {
      const operation = document.paths['/api/teams']?.post;

      expect(Object.keys(operation?.responses ?? {})).toEqual(
        expect.arrayContaining(['201', '400', '401', '403', '409']),
      );
    });
  });
});
