import { Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard.js';

// Adaptador para entregas anteriores; delega la regla y no duplica autorización.
@Injectable()
export class AdminGuard extends RolesGuard {
  constructor(reflector: Reflector) {
    super(reflector);
  }

  override canActivate(context: ExecutionContext): boolean {
    return this.requireRoles(context, ['admin']);
  }
}
