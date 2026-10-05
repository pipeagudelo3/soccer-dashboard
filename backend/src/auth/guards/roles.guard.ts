import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { User } from '../../users/entities/user.entity.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedRequestInterface } from '../interfaces/authenticated-user.interface.js';

// JwtAuthGuard se ejecuta primero y obtiene el rol vigente de la base.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<User['role'][]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles === undefined) return true;
    return this.requireRoles(context, roles);
  }

  protected requireRoles(context: ExecutionContext, roles: User['role'][]): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequestInterface>();
    if (request.user === undefined || !roles.includes(request.user.role)) {
      throw new ForbiddenException('Administrator access is required.');
    }
    return true;
  }
}
