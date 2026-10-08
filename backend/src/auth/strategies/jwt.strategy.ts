import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import type { Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity.js';
import type { AuthenticatedUserInterface } from '../interfaces/authenticated-user.interface.js';

// Estrategia Nest con JwtService ya instalado: no introduce Passport ni otro algoritmo.
@Injectable()
export class JwtStrategy {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
  ) {}

  async authenticate(token: string): Promise<AuthenticatedUserInterface> {
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwtService.verifyAsync<Record<string, unknown>>(token, {
        algorithms: ['HS256'],
      });
      const now = Math.floor(Date.now() / 1000);
      if (
        typeof payload.sub !== 'string' ||
        !isUUID(payload.sub, '4') ||
        typeof payload.exp !== 'number' ||
        !Number.isSafeInteger(payload.exp) ||
        payload.exp <= now ||
        typeof payload.iat !== 'number' ||
        !Number.isSafeInteger(payload.iat) ||
        payload.iat < 0 ||
        payload.iat > now ||
        payload.exp <= payload.iat
      )
        throw new Error('Invalid session claims.');
    } catch {
      throw new UnauthorizedException('The session is invalid or expired.');
    }

    // No confía en roles del token. Los fallos DB siguen siendo 5xx diagnosticables.
    const user = await this.usersRepository.findOneBy({ id: payload.sub });
    if (user === null || !['admin', 'user'].includes(user.role)) {
      throw new UnauthorizedException('The session is invalid or expired.');
    }
    return { id: user.id, role: user.role };
  }
}
