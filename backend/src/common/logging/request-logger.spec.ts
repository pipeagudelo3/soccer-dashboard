import { EventEmitter } from 'node:events';

import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

import { requestLogger } from './request-logger.js';

// Comprueba qué se registra y, sobre todo, qué datos de la petición nunca llegan al logger.
describe('requestLogger', () => {
  const secret = 'Bearer-Token-And-Password-123';

  afterEach(() => jest.restoreAllMocks());

  it('logs method, path, status and duration once the response finishes', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const response = Object.assign(new EventEmitter(), { statusCode: 401 }) as unknown as Response;
    const request = {
      method: 'POST',
      path: '/api/auth/login',
      originalUrl: `/api/auth/login?token=${secret}`,
      headers: { authorization: secret },
      body: { password: secret },
    } as unknown as Request;
    const next = jest.fn();

    requestLogger(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();

    response.emit('finish');

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({
      event: 'http_request',
      method: 'POST',
      path: '/api/auth/login',
      statusCode: 401,
      durationMs: expect.any(Number) as number,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });
});
