import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { AuthenticatedUserInterface } from '@/interfaces/AuthenticatedUserInterface.js';

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<AuthenticatedUserInterface | null>(null);

  const isAuthenticated = computed<boolean>(() => currentUser.value !== null);
  const isAdmin = computed<boolean>(() => currentUser.value?.role === 'admin');

  function setCurrentUser(user: AuthenticatedUserInterface): void {
    currentUser.value = { ...user };
  }

  function clearCurrentUser(): void {
    currentUser.value = null;
  }

  return {
    currentUser,
    isAuthenticated,
    isAdmin,
    setCurrentUser,
    clearCurrentUser,
  };
});
