import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequestInterface } from '../interfaces/authenticated-user.interface.js';

// Debe ejecutarse después de JwtAuthGuard: el rol procede del registro vigente.
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequestInterface>();
    if (request.user?.role !== 'admin') {
      throw new ForbiddenException('Administrator access is required.');
    }
    return true;
  }
}
