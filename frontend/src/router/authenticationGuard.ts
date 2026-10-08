import type { NavigationGuardReturn, RouteLocationNormalized, Router } from 'vue-router';

import { AuthService } from '@/services/AuthService.js';
import { useAuthStore } from '@/stores/authstore.js';

export async function authenticationGuard(
  to: RouteLocationNormalized,
): Promise<NavigationGuardReturn> {
  const store = useAuthStore();

  // Revalidate identity and the current database role before exposing protected routes.
  if (to.meta.requiresAuth === true || store.isSessionLoading || to.name === 'login') {
    await AuthService.reconcileSession();
  }

  if (to.name === 'login' && store.isAuthenticated) {
    return { name: 'dashboard' };
  }
  if (to.meta.requiresAuth === true && !store.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.requiresAdmin === true && !store.isAdmin) {
    return { name: 'dashboard' };
  }
  return true;
}

export function resolveLoginRedirect(router: Router, value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return '/dashboard';
  }
  const target = router.resolve(value);
  return target.matched.length > 0 && target.name !== 'login' ? target.fullPath : '/dashboard';
}
