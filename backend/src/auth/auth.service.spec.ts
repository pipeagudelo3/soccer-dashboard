import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Repository } from 'typeorm';

import type { EnvironmentConfiguration } from '../config/environment.js';
import { User } from '../users/entities/user.entity.js';
import type { PasswordService } from '../users/password.service.js';
import { AuthService } from './auth.service.js';

// Aísla selección de credenciales, comparación y perfil seguro sin registrar datos privados.
describe('AuthService', () => {
  const findOne = jest.fn<() => Promise<User | null>>();
  const findOneBy = jest.fn<() => Promise<User | null>>();
  const hashPassword = jest.fn<(password: string) => Promise<string>>();
  const verifyPassword = jest.fn<(password: string, hash: string) => Promise<boolean>>();
  const signAsync =
    jest.fn<
      (
        payload: { sub: string },
        options: { algorithm: string; expiresIn: number },
      ) => Promise<string>
    >();
  const repository = { findOne, findOneBy } as unknown as Repository<User>;
  const passwordService = { hashPassword, verifyPassword } as unknown as PasswordService;
  const jwtService = { signAsync } as unknown as JwtService;
  const configuration = { get: () => '15m' } as unknown as ConfigService<
    EnvironmentConfiguration,
    true
  >;
  let service: AuthService;
  let user: User;

  beforeEach(async () => {
    jest.clearAllMocks();
    user = Object.assign(new User(), {
      id: 'user',
      name: 'Demo',
      email: 'user@soccer.example',
      role: 'user',
      passwordHash: 'private-hash',
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2020-01-01'),
    });
    findOne.mockResolvedValue(user);
    findOneBy.mockResolvedValue(user);
    hashPassword.mockResolvedValue('dummy-hash');
    verifyPassword.mockResolvedValue(true);
    signAsync.mockResolvedValue('access-token');
    service = new AuthService(repository, passwordService, jwtService, configuration);
    await service.onModuleInit();
  });

  it('normalizes email and selects the hash only for login', async () => {
    const result = await service.login({ email: ' USER@SOCCER.EXAMPLE ', password: 'Password123' });
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'user@soccer.example' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          passwordHash: true,
        },
      }),
    );
    expect(verifyPassword).toHaveBeenCalledWith('Password123', 'private-hash');
    expect(signAsync).toHaveBeenCalledWith({ sub: 'user' }, { algorithm: 'HS256', expiresIn: 900 });
    expect(result).toMatchObject({
      accessToken: 'access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    expect(JSON.stringify(result)).not.toContain('private-hash');
    expect(Object.keys(result.user)).toHaveLength(6);
  });

  it('uses a dummy comparison for an unknown email and never issues a token', async () => {
    findOne.mockResolvedValue(null);
    await expect(
      service.login({ email: 'missing@soccer.example', password: 'WrongPassword123' }),
    ).rejects.toThrow('Invalid email or password.');
    expect(verifyPassword).toHaveBeenCalledWith('WrongPassword123', 'dummy-hash');
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('returns the same generic error for a wrong password', async () => {
    verifyPassword.mockResolvedValue(false);
    await expect(
      service.login({ email: user.email, password: 'WrongPassword123' }),
    ).rejects.toThrow('Invalid email or password.');
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('does not trim passwords and rejects more than 72 UTF-8 bytes', async () => {
    await service.login({ email: user.email, password: ' Password123 ' });
    expect(verifyPassword).toHaveBeenCalledWith(' Password123 ', user.passwordHash);
    await expect(
      service.login({ email: user.email, password: 'é'.repeat(37) }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('loads the current profile and role for me without selecting its hash', async () => {
    user.role = 'admin';
    const result = await service.me({ id: user.id, role: 'user' });
    expect(findOneBy).toHaveBeenCalledWith({ id: user.id });
    expect(result.role).toBe('admin');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects a user deleted before the profile is read', async () => {
    findOneBy.mockResolvedValue(null);
    await expect(service.me({ id: user.id, role: 'user' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('preserves database failures for secure 5xx diagnosis', async () => {
    const error = new Error('private database failure');
    findOne.mockRejectedValueOnce(error);
    await expect(service.login({ email: user.email, password: 'Password123' })).rejects.toBe(error);
  });
});
