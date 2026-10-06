import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import type { Repository } from 'typeorm';

import { User } from '../../users/entities/user.entity.js';
import type { AuthenticatedRequestInterface } from '../interfaces/authenticated-user.interface.js';

// Interfaz de verificación reutilizable por auth #47, sin añadir un login en este issue.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequestInterface>();
    const authorization = request.headers.authorization;
    const token =
      typeof authorization === 'string' ? /^Bearer ([^\s]+)$/i.exec(authorization)?.[1] : undefined;
    if (token === undefined) throw new UnauthorizedException('A valid bearer token is required.');

    // Solo HS256; exige identidad UUID y expiración, incluso si la firma es válida.
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwtService.verifyAsync<Record<string, unknown>>(token, {
        algorithms: ['HS256'],
      });
      if (
        typeof payload.sub !== 'string' ||
        !isUUID(payload.sub, '4') ||
        typeof payload.exp !== 'number' ||
        !Number.isFinite(payload.exp) ||
        typeof payload.iat !== 'number' ||
        !Number.isFinite(payload.iat) ||
        payload.iat > Math.floor(Date.now() / 1000)
      ) {
        throw new Error('Invalid session claims.');
      }
    } catch {
      throw new UnauthorizedException('The session is invalid or expired.');
    }

    // Un usuario eliminado pierde acceso; un rol modificado se aplica inmediatamente.
    const user = await this.usersRepository.findOneBy({ id: payload.sub });
    if (user === null) throw new UnauthorizedException('The session is invalid or expired.');
    request.user = { id: user.id, role: user.role };
    return true;
  }
}
