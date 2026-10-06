import './test-environment.js';

import request from 'supertest';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';

import { createApplication } from '../src/create-application.js';

// Arranca y cierra la aplicación real, con la misma configuración HTTP que main.ts.
describe('Health endpoint (e2e)', () => {
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

  // Verifica ruta, código HTTP y contrato JSON sin requerir autenticación.
  it('GET /api/health returns the public status', async () => {
    await request(server)
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('does not expose the health route without the API prefix', async () => {
    await request(server).get('/health').expect(404);
  });

  // Comprueba el header que permite el acceso desde el frontend configurado.
  it('allows the configured frontend origin', async () => {
    await request(server)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173')
      .expect('Access-Control-Allow-Origin', 'http://localhost:5173')
      .expect(200);
  });

  it('does not grant browser CORS access to an unapproved origin', async () => {
    const response = await request(server)
      .get('/api/health')
      .set('Origin', 'https://unapproved.example.com')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
