import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity.js';
import { JwtStrategy } from './jwt.strategy.js';

// Valida claims y resolución vigente del usuario, independientemente del token emitido.
describe('JwtStrategy', () => {
  const id = '10000000-0000-4000-8000-000000000001';
  const verifyAsync = jest.fn<() => Promise<Record<string, unknown>>>();
  const findOneBy = jest.fn<() => Promise<User | null>>();
  const repository = { findOneBy } as unknown as Repository<User>;
  const jwtService = { verifyAsync } as unknown as JwtService;
  const strategy = new JwtStrategy(jwtService, repository);
  let payload: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    const now = Math.floor(Date.now() / 1000);
    payload = { sub: id, iat: now - 1, exp: now + 900, role: 'admin' };
    verifyAsync.mockImplementation(() => Promise.resolve(payload));
    findOneBy.mockResolvedValue(Object.assign(new User(), { id, role: 'user' }));
  });

  it('restricts verification to HS256 and ignores the token role', async () => {
    await expect(strategy.authenticate('token')).resolves.toEqual({ id, role: 'user' });
    expect(verifyAsync).toHaveBeenCalledWith('token', { algorithms: ['HS256'] });
    expect(findOneBy).toHaveBeenCalledWith({ id });
  });

  it.each([
    { sub: 'not-uuid' },
    { sub: null },
    { exp: undefined },
    { exp: Infinity },
    { exp: -1 },
    { iat: undefined },
    { iat: -1 },
    { iat: Infinity },
    { iat: 9999999999 },
  ])('rejects invalid claims %# before consulting the database', async (changes) => {
    payload = { ...payload, ...changes };
    await expect(strategy.authenticate('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findOneBy).not.toHaveBeenCalled();
  });

  it('rejects a lifetime ending at or before issue time', async () => {
    const now = Math.floor(Date.now() / 1000);
    payload = { ...payload, iat: now, exp: now };
    await expect(strategy.authenticate('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('uses a generic error for cryptographic verification failures', async () => {
    verifyAsync.mockRejectedValueOnce(new Error('private signing detail'));
    await expect(strategy.authenticate('token')).rejects.toThrow(
      'The session is invalid or expired.',
    );
  });

  it('rejects deleted users and preserves failures of the database', async () => {
    findOneBy.mockResolvedValueOnce(null);
    await expect(strategy.authenticate('token')).rejects.toBeInstanceOf(UnauthorizedException);
    const error = new Error('database failure');
    findOneBy.mockRejectedValueOnce(error);
    await expect(strategy.authenticate('token')).rejects.toBe(error);
  });
});
