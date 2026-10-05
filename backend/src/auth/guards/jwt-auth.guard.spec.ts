import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequestInterface } from '../interfaces/authenticated-user.interface.js';
import type { JwtStrategy } from '../strategies/jwt.strategy.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

// El guard solo transporta el Bearer y delega la política criptográfica a la estrategia.
describe('JwtAuthGuard', () => {
  const authenticate = jest.fn<(token: string) => Promise<{ id: string; role: 'user' }>>();
  const strategy = { authenticate } as unknown as JwtStrategy;
  const guard = new JwtAuthGuard(strategy);

  beforeEach(() => {
    jest.clearAllMocks();
    authenticate.mockResolvedValue({ id: 'user', role: 'user' });
  });

  function setup(authorization?: unknown): {
    request: AuthenticatedRequestInterface;
    context: ExecutionContext;
  } {
    const request = { headers: { authorization } } as AuthenticatedRequestInterface;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { request, context };
  }

  it('attaches the safe identity supplied by the strategy', async () => {
    const { request, context } = setup('bearer token');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalledWith('token');
    expect(request.user).toEqual({ id: 'user', role: 'user' });
  });

  it.each([undefined, '', 'Basic token', 'Bearer', 'Bearer a b', ['Bearer token']])(
    'rejects malformed authorization %#',
    async (header) => {
      await expect(guard.canActivate(setup(header).context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(authenticate).not.toHaveBeenCalled();
    },
  );
});
