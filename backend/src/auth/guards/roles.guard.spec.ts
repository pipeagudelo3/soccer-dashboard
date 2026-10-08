import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Roles } from '../decorators/roles.decorator.js';
import type { AuthenticatedUserInterface } from '../interfaces/authenticated-user.interface.js';
import { AdminGuard } from './admin.guard.js';
import { RolesGuard } from './roles.guard.js';

@Roles('admin')
class Policy {
  admin(this: void): boolean {
    return true;
  }
  @Roles('user')
  regular(this: void): boolean {
    return true;
  }
}

// Comprueba metadatos de clase/método y compatibilidad del guard administrativo previo.
describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  function context(handler: () => boolean, actor?: AuthenticatedUserInterface): ExecutionContext {
    return {
      getClass: () => Policy,
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => ({ user: actor }) }),
    } as unknown as ExecutionContext;
  }

  it('enforces class roles and permits administrators', () => {
    expect(guard.canActivate(context(Policy.prototype.admin, { id: 'admin', role: 'admin' }))).toBe(
      true,
    );
    expect(() =>
      guard.canActivate(context(Policy.prototype.admin, { id: 'user', role: 'user' })),
    ).toThrow(ForbiddenException);
  });

  it('lets method roles override the class policy', () => {
    expect(guard.canActivate(context(Policy.prototype.regular, { id: 'user', role: 'user' }))).toBe(
      true,
    );
    expect(() =>
      guard.canActivate(context(Policy.prototype.regular, { id: 'admin', role: 'admin' })),
    ).toThrow(ForbiddenException);
  });

  it('rejects missing users for a protected role', () => {
    expect(() => guard.canActivate(context(Policy.prototype.admin))).toThrow(ForbiddenException);
  });

  it('keeps AdminGuard restrictive even without decorator metadata', () => {
    const compatibilityGuard = new AdminGuard(new Reflector());
    expect(() =>
      compatibilityGuard.canActivate(
        context(Policy.prototype.regular, { id: 'user', role: 'user' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows a handler without a role policy', () => {
    const emptyContext = {
      getClass: () => Object,
      getHandler: () => Boolean,
    } as unknown as ExecutionContext;
    expect(guard.canActivate(emptyContext)).toBe(true);
  });
});
