import { watch } from 'vue';
import type { WatchStopHandle } from 'vue';
import type { Router } from 'vue-router';

import { useAuthStore } from '@/stores/authstore.js';

export function registerSessionNavigation(router: Router): WatchStopHandle {
  const store = useAuthStore();
  let isRedirecting = false;

  // Handle expiry/401 on the active page; the transport service never navigates.
  return watch(
    [() => store.isAuthenticated, () => store.isAdmin, () => store.isSessionLoading],
    async ([isAuthenticated, isAdmin, isLoading]) => {
      const route = router.currentRoute.value;
      // The target guard also revalidates the session; do not restart its pending navigation.
      if (isLoading || isRedirecting) return;

      const target =
        route.meta.requiresAuth === true && !isAuthenticated
          ? { name: 'login', query: { redirect: route.fullPath } }
          : route.meta.requiresAdmin === true && !isAdmin && isAuthenticated
            ? { name: 'dashboard' }
            : null;

      if (target === null) return;
      isRedirecting = true;
      try {
        await router.replace(target);
      } finally {
        isRedirecting = false;
      }
    },
  );
}
