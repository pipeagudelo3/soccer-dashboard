import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequestInterface } from '../interfaces/authenticated-user.interface.js';
import { JwtStrategy } from '../strategies/jwt.strategy.js';

// Extrae únicamente un Bearer del header; no acepta tokens en URLs ni cuerpos.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtStrategy: JwtStrategy) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequestInterface>();
    const authorization = request.headers.authorization;
    const token =
      typeof authorization === 'string' ? /^Bearer ([^\s]+)$/i.exec(authorization)?.[1] : undefined;
    if (token === undefined) throw new UnauthorizedException('A valid bearer token is required.');
    request.user = await this.jwtStrategy.authenticate(token);
    return true;
  }
}
