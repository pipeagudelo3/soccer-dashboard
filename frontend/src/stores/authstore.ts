import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { AuthenticatedUserInterface } from '@/interfaces/AuthenticatedUserInterface.js';

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<AuthenticatedUserInterface | null>(null);
  // JWTs are ephemeral: configurePinia excludes this field when loading and saving state.
  const accessToken = ref<string | null>(null);

  const isAuthenticated = computed<boolean>(() => currentUser.value !== null);
  const isAdmin = computed<boolean>(() => currentUser.value?.role === 'admin');

  function setCurrentUser(user: AuthenticatedUserInterface): void {
    // Replacing the identity must not retain a token belonging to the previous account.
    if (currentUser.value?.id !== user.id) {
      accessToken.value = null;
    }

    currentUser.value = { ...user };
  }

  function clearCurrentUser(): void {
    currentUser.value = null;
    accessToken.value = null;
  }

  function setAccessToken(token: string | null): void {
    accessToken.value = token;
  }

  return {
    currentUser,
    accessToken,
    isAuthenticated,
    isAdmin,
    setCurrentUser,
    clearCurrentUser,
    setAccessToken,
  };
});
