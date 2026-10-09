import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { AuthenticatedUserInterface } from '@/interfaces/AuthenticatedUserInterface.js';

export const useAuthStore = defineStore('auth', () => {
  // Session state stays in memory; no persistence plugin or storage subscription is installed.
  const currentUser = ref<AuthenticatedUserInterface | null>(null);
  const accessToken = ref<string | null>(null);
  const expiresAt = ref<number | null>(null);
  const isSessionLoading = ref(true);
  const isSessionVerified = ref(false);
  const sessionError = ref<string | null>(null);
  const sessionVersion = ref(0);

  const isAuthenticated = computed<boolean>(
    () =>
      !isSessionLoading.value &&
      isSessionVerified.value &&
      currentUser.value !== null &&
      accessToken.value !== null &&
      expiresAt.value !== null &&
      expiresAt.value > Date.now(),
  );
  const isAdmin = computed<boolean>(
    () => isAuthenticated.value && currentUser.value?.role === 'admin',
  );

  // Transport integration points: assigning a token alone never authenticates a user.
  function setCurrentUser(user: AuthenticatedUserInterface): void {
    if (currentUser.value?.id !== user.id) {
      accessToken.value = null;
      expiresAt.value = null;
      isSessionVerified.value = false;
    }
    currentUser.value = { ...user };
  }

  function setAccessToken(token: string | null): void {
    accessToken.value = token;
    isSessionVerified.value = false;
  }

  function clearCurrentUser(): void {
    sessionVersion.value += 1;
    currentUser.value = null;
    accessToken.value = null;
    expiresAt.value = null;
    isSessionVerified.value = false;
    isSessionLoading.value = false;
    sessionError.value = null;
  }

  function beginLogin(): number {
    sessionVersion.value += 1;
    // LoginView owns submission loading; hiding RouterView here would unmount its form.
    sessionError.value = null;
    return sessionVersion.value;
  }

  function startSessionCheck(): void {
    isSessionLoading.value = true;
    isSessionVerified.value = false;
    sessionError.value = null;
  }

  function finishSessionCheck(version: number): void {
    if (sessionVersion.value === version) isSessionLoading.value = false;
  }

  function setSession(user: AuthenticatedUserInterface, token: string, deadline: number): void {
    sessionVersion.value += 1;
    currentUser.value = { ...user };
    accessToken.value = token;
    expiresAt.value = deadline;
    isSessionVerified.value = true;
    isSessionLoading.value = false;
    sessionError.value = null;
  }

  function confirmSession(user: AuthenticatedUserInterface): void {
    currentUser.value = { ...user };
    isSessionVerified.value = true;
    sessionError.value = null;
  }

  function setSessionError(message: string): void {
    isSessionVerified.value = false;
    sessionError.value = message;
  }

  return {
    currentUser,
    accessToken,
    expiresAt,
    isSessionLoading,
    isSessionVerified,
    sessionError,
    sessionVersion,
    isAuthenticated,
    isAdmin,
    setCurrentUser,
    clearCurrentUser,
    setAccessToken,
    beginLogin,
    startSessionCheck,
    finishSessionCheck,
    setSession,
    confirmSession,
    setSessionError,
  };
});
