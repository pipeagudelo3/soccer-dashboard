import type { LoginDTO } from '@/dtos/LoginDTO.js';
import type { AuthenticatedUserInterface } from '@/interfaces/AuthenticatedUserInterface.js';
import { ApiService } from '@/services/ApiService.js';
import type { ServiceResult } from '@/services/ServiceResult.js';
import { useAuthStore } from '@/stores/authstore.js';

type AuthStore = ReturnType<typeof useAuthStore>;

interface SessionCheck {
  token: string;
  version: number;
  result: Promise<ServiceResult<AuthenticatedUserInterface | null>>;
}

// Reconstruct the minimal public profile; additional backend fields are discarded.
function readProfile(value: unknown): AuthenticatedUserInterface | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id) ||
    !('name' in value) ||
    typeof value.name !== 'string' ||
    value.name.trim() === '' ||
    !('email' in value) ||
    typeof value.email !== 'string' ||
    value.email.trim() === '' ||
    !('role' in value) ||
    (value.role !== 'admin' && value.role !== 'user')
  ) {
    return null;
  }
  return { id: value.id, name: value.name, email: value.email, role: value.role };
}

function readSession(value: unknown): {
  user: AuthenticatedUserInterface;
  token: string;
  expiresAt: number;
} | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('accessToken' in value) ||
    typeof value.accessToken !== 'string' ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.accessToken) ||
    !('tokenType' in value) ||
    value.tokenType !== 'Bearer' ||
    !('expiresIn' in value) ||
    typeof value.expiresIn !== 'number' ||
    !Number.isSafeInteger(value.expiresIn) ||
    value.expiresIn < 1 ||
    value.expiresIn > 3600 ||
    !('user' in value)
  ) {
    return null;
  }

  const user = readProfile(value.user);
  const payload = value.accessToken.split('.')[1];
  if (user === null || payload === undefined) return null;

  // Claims only bound the local expiry timer; NestJS verifies signatures and authorizes requests.
  try {
    const claims: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (
      typeof claims !== 'object' ||
      claims === null ||
      !('sub' in claims) ||
      claims.sub !== user.id ||
      !('exp' in claims) ||
      typeof claims.exp !== 'number' ||
      !Number.isSafeInteger(claims.exp)
    ) {
      return null;
    }
    const expiresAt = Math.min(Date.now() + value.expiresIn * 1000, claims.exp * 1000);
    return expiresAt > Date.now() ? { user, token: value.accessToken, expiresAt } : null;
  } catch {
    return null;
  }
}

export class AuthService {
  private static checks = new WeakMap<AuthStore, SessionCheck>();
  private static expiryTimers = new WeakMap<AuthStore, ReturnType<typeof setTimeout>>();

  static async login(credentials: LoginDTO): Promise<ServiceResult<AuthenticatedUserInterface>> {
    const store = useAuthStore();
    const version = store.beginLogin();
    const email = credentials.email.trim().toLowerCase();

    if (email === '' || credentials.password === '') {
      store.finishSessionCheck(version);
      return { success: false, errors: ['Invalid email or password.'] };
    }

    const result = await ApiService.request<unknown>({
      url: '/auth/login',
      method: 'POST',
      data: { email, password: credentials.password },
      requiresAuth: false,
    });

    // A later login or explicit logout wins over an earlier response.
    if (store.sessionVersion !== version) {
      return { success: false, errors: ['The sign-in request is no longer active.'] };
    }
    if (!result.success) {
      store.finishSessionCheck(version);
      return result;
    }

    const session = readSession(result.data);
    if (session === null) {
      AuthService.clearSession(store);
      return { success: false, errors: ['Unable to establish a valid session. Please try again.'] };
    }
    store.setSession(session.user, session.token, session.expiresAt);
    AuthService.scheduleExpiration(store);
    return { success: true, data: session.user };
  }

  static logout(): void {
    AuthService.clearSession(useAuthStore());
  }

  static getCurrentUser(): AuthenticatedUserInterface | null {
    const store = useAuthStore();
    return store.isAuthenticated ? store.currentUser : null;
  }

  static isAuthenticated(): boolean {
    return useAuthStore().isAuthenticated;
  }
  static isAdmin(): boolean {
    return useAuthStore().isAdmin;
  }

  static reconcileSession(
    options: { background?: boolean } = {},
  ): Promise<ServiceResult<AuthenticatedUserInterface | null>> {
    const store = useAuthStore();
    const token = store.accessToken;
    if (token === null || store.expiresAt === null || store.expiresAt <= Date.now()) {
      AuthService.clearSession(store);
      return Promise.resolve({ success: true, data: null });
    }

    // Post-write/403 checks update identity without unmounting the active form.
    // Route guards still use blocking reconciliation before exposing protected content.
    if (!options.background) store.startSessionCheck();
    const pending = AuthService.checks.get(store);
    if (pending?.token === token && pending.version === store.sessionVersion) return pending.result;

    const version = store.sessionVersion;
    const result = AuthService.checkCurrentUser(store, token, version);
    AuthService.checks.set(store, { token, version, result });
    return result;
  }

  private static async checkCurrentUser(
    store: AuthStore,
    token: string,
    version: number,
  ): Promise<ServiceResult<AuthenticatedUserInterface | null>> {
    try {
      const result = await ApiService.request<unknown>({ url: '/auth/me' });
      if (store.sessionVersion !== version || store.accessToken !== token) {
        return { success: false, errors: ['The session has changed. Please try again.'] };
      }
      if (!result.success) {
        // Shared transport handles 401. A transient failure retains only the in-memory token.
        store.setSessionError(result.errors[0] ?? 'Unable to validate your session.');
        return result;
      }

      const user = readProfile(result.data);
      if (user === null || (store.currentUser !== null && user.id !== store.currentUser.id)) {
        AuthService.clearSession(store);
        return {
          success: false,
          errors: ['The session is no longer valid. Please sign in again.'],
        };
      }
      store.confirmSession(user);
      AuthService.scheduleExpiration(store);
      return { success: true, data: user };
    } finally {
      const pending = AuthService.checks.get(store);
      if (pending?.token === token && pending.version === version) AuthService.checks.delete(store);
      store.finishSessionCheck(version);
    }
  }

  private static scheduleExpiration(store: AuthStore): void {
    AuthService.cancelExpiration(store);
    const token = store.accessToken;
    const expiresAt = store.expiresAt;
    if (token === null || expiresAt === null) return;

    const timer = setTimeout(
      () => {
        if (store.accessToken === token && store.expiresAt === expiresAt)
          AuthService.clearSession(store);
      },
      Math.max(0, expiresAt - Date.now()),
    );
    AuthService.expiryTimers.set(store, timer);
  }

  private static cancelExpiration(store: AuthStore): void {
    const timer = AuthService.expiryTimers.get(store);
    if (timer !== undefined) {
      clearTimeout(timer);
      AuthService.expiryTimers.delete(store);
    }
  }

  private static clearSession(store: AuthStore): void {
    AuthService.cancelExpiration(store);
    AuthService.checks.delete(store);
    store.clearCurrentUser();
  }
}
