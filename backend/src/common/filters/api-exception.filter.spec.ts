import { jest } from '@jest/globals';
import { BadRequestException, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { ApiExceptionFilter } from './api-exception.filter.js';

// Comprueba las dos fronteras: respuesta pública y diagnóstico interno sin datos privados.
describe('ApiExceptionFilter', () => {
  const privateValue = 'PrivatePassword123-BearerToken';
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({
        originalUrl: `/api/users?token=${privateValue}`,
        body: { password: privateValue },
        headers: { authorization: privateValue },
      }),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  let logError = jest.spyOn(Logger.prototype, 'error');

  beforeEach(() => {
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    json.mockClear();
    status.mockClear();
  });

  afterEach(() => jest.restoreAllMocks());

  it('logs a database failure with its known code and safe source location', () => {
    const driverError = Object.assign(new Error(privateValue), { code: 'SQLITE_BUSY' });
    const exception = new QueryFailedError(`INSERT ${privateValue}`, [privateValue], driverError);
    exception.stack = `${exception.message}\n    at sensitiveFunction (/private/server/src/users/users.service.ts:42:7)`;

    new ApiExceptionFilter().catch(exception, host);

    expect(logError).toHaveBeenCalledWith({
      event: 'http_server_error',
      statusCode: 500,
      type: 'QueryFailedError',
      code: 'SQLITE_BUSY',
      locations: ['src/users/users.service.ts:42:7'],
    });
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: ['Internal server error.'],
        path: '/api/users',
      }),
    );
    const output = JSON.stringify([logError.mock.calls, json.mock.calls]);
    expect(output).not.toContain(privateValue);
    expect(output).not.toContain('INSERT');
    expect(output).not.toContain('/private/server');
    expect(output).not.toContain('sensitiveFunction');
  });

  it.each([500, 502, 503])('logs HTTP %i without leaking its private message', (statusCode) => {
    new ApiExceptionFilter().catch(new HttpException(privateValue, statusCode), host);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith(statusCode);
    expect(JSON.stringify([logError.mock.calls, json.mock.calls])).not.toContain(privateValue);
    expect(json.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        message: [
          statusCode === 503 ? 'Service temporarily unavailable.' : 'Internal server error.',
        ],
      }),
    );
  });

  it('does not log expected client errors', () => {
    new ApiExceptionFilter().catch(new BadRequestException('Invalid input.'), host);
    expect(logError).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ message: ['Invalid input.'] }),
    );
  });

  it('does not serialize arbitrary thrown objects', () => {
    new ApiExceptionFilter().catch({ password: privateValue, stack: privateValue }, host);
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'UnknownError', locations: [] }),
    );
    expect(JSON.stringify(logError.mock.calls)).not.toContain(privateValue);
  });

  it('rejects unrecognized database codes and custom exception names', () => {
    const driverError = Object.assign(new Error(privateValue), { code: privateValue });
    const exception = new QueryFailedError('SELECT secret', [], driverError);
    Object.defineProperty(exception, 'name', { value: privateValue });
    exception.stack = privateValue;
    new ApiExceptionFilter().catch(exception, host);
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'QueryFailedError', code: undefined, locations: [] }),
    );
    expect(JSON.stringify(logError.mock.calls)).not.toContain(privateValue);
  });
});
