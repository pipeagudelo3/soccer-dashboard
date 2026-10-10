import { computed, onScopeDispose, ref, watch } from 'vue';

import type { CreateUserDTO } from '@/dtos/CreateUserDTO.js';
import type { UpdateUserDTO } from '@/dtos/UpdateUserDTO.js';
import type { UserInterface } from '@/interfaces/UserInterface.js';
import type { ServiceResult } from '@/services/ServiceResult.js';
import { UserService } from '@/services/UserService.js';
import { useAuthStore } from '@/stores/authstore.js';

// Ephemeral page state; the database owns users and no user domain store supplies this list.
export function useUserAdministration() {
  const authStore = useAuthStore();
  const users = ref<UserInterface[]>([]);
  const isLoading = ref(false);
  const hasLoaded = ref(false);
  const loadErrors = ref<string[]>([]);
  const feedbackErrors = ref<string[]>([]);
  const feedbackMessage = ref<string | null>(null);
  const isFormOpen = ref(false);
  const editingUser = ref<UserInterface | null>(null);
  const isSaving = ref(false);
  const pendingUserId = ref<string | null>(null);
  const isEditingStale = ref(false);
  let loadVersion = 0;
  let editVersion = 0;
  let isDisposed = false;

  const isBusy = computed(() => isLoading.value || isSaving.value || pendingUserId.value !== null);
  function clearFeedback(): void {
    feedbackErrors.value = [];
    feedbackMessage.value = null;
  }
  function closeForm(): void {
    if (isSaving.value) return;
    editVersion += 1;
    isFormOpen.value = false;
    editingUser.value = null;
    isEditingStale.value = false;
    feedbackErrors.value = [];
  }
  function openCreateForm(): void {
    if (isBusy.value || !authStore.isAdmin) return;
    closeForm();
    clearFeedback();
    isFormOpen.value = true;
  }

  async function loadUsers(): Promise<void> {
    if (isSaving.value || pendingUserId.value !== null) return;
    const version = ++loadVersion;
    const token = authStore.accessToken;
    isLoading.value = true;
    loadErrors.value = [];
    try {
      const result = await UserService.getUsers();
      if (isDisposed || version !== loadVersion || token !== authStore.accessToken) return;
      if (!result.success) {
        loadErrors.value = result.errors;
        return;
      }
      users.value = result.data;
      hasLoaded.value = true;
      if (
        editingUser.value !== null &&
        !users.value.some((user) => user.id === editingUser.value?.id)
      ) {
        isEditingStale.value = true;
        feedbackErrors.value = [
          'The selected user was deleted. Cancel editing or reload its record.',
        ];
      }
    } finally {
      if (version === loadVersion) isLoading.value = false;
    }
  }

  async function openEditForm(id: string): Promise<void> {
    if (isBusy.value || !authStore.isAdmin) return;
    const version = ++editVersion;
    const token = authStore.accessToken;
    pendingUserId.value = id;
    clearFeedback();
    try {
      // Read a fresh record before editing; another administrator may have changed/deleted it.
      const result = await UserService.getUserById(id);
      if (isDisposed || version !== editVersion || token !== authStore.accessToken) return;
      if (!result.success) {
        feedbackErrors.value = result.errors;
        if (result.statusCode === 404) users.value = users.value.filter((user) => user.id !== id);
        return;
      }
      editingUser.value = result.data;
      isEditingStale.value = false;
      isFormOpen.value = true;
    } finally {
      pendingUserId.value = null;
    }
  }

  async function saveUser(
    operation: () => Promise<ServiceResult<UserInterface>>,
    id?: string,
  ): Promise<void> {
    if (
      isSaving.value ||
      isLoading.value ||
      pendingUserId.value !== null ||
      isEditingStale.value ||
      !authStore.isAdmin
    )
      return;
    const token = authStore.accessToken;
    isSaving.value = true;
    clearFeedback();
    try {
      const result = await operation();
      if (isDisposed || token !== authStore.accessToken) return;
      if (!result.success) {
        feedbackErrors.value = result.errors;
        if (id !== undefined && result.statusCode === 404) {
          users.value = users.value.filter((user) => user.id !== id);
          isEditingStale.value = true;
        }
        return;
      }
      // The server response supplies normalized fields and timestamps, never local guesses.
      users.value =
        id === undefined
          ? [...users.value.filter((user) => user.id !== result.data.id), result.data]
          : users.value.map((user) => (user.id === id ? result.data : user));
      isFormOpen.value = false;
      editingUser.value = null;
      feedbackMessage.value =
        id === undefined ? 'User created successfully.' : 'User updated successfully.';
    } finally {
      isSaving.value = false;
    }
  }

  async function deleteUser(id: string): Promise<ServiceResult<undefined>> {
    if (isDisposed || isBusy.value || !authStore.isAdmin) {
      return { success: false, errors: ['The operation is unavailable. Please try again.'] };
    }
    pendingUserId.value = id;
    const token = authStore.accessToken;
    clearFeedback();
    try {
      const result = await UserService.deleteUser(id);
      if (isDisposed) return result.success ? { success: true, data: undefined } : result;
      if ((!result.success || !result.data.deletedCurrentUser) && token !== authStore.accessToken) {
        return { success: false, errors: ['The session has changed.'] };
      }
      if (!result.success) {
        feedbackErrors.value = result.errors;
        if (result.statusCode === 404) {
          users.value = users.value.filter((user) => user.id !== id);
          if (editingUser.value?.id === id) isEditingStale.value = true;
        }
        return result;
      }
      users.value = users.value.filter((user) => user.id !== id);
      if (editingUser.value?.id === id) closeForm();
      feedbackMessage.value = 'User deleted successfully.';
      return { success: true, data: undefined };
    } finally {
      pendingUserId.value = null;
    }
  }

  function createUser(payload: CreateUserDTO): Promise<void> {
    return saveUser(() => UserService.createUser(payload));
  }
  function updateUser(payload: UpdateUserDTO): Promise<void> {
    const id = editingUser.value?.id;
    return id === undefined
      ? Promise.resolve()
      : saveUser(() => UserService.updateUser(id, payload), id);
  }

  // A view kept alive during a session switch must never display the previous admin's list.
  watch(
    () => authStore.accessToken,
    () => {
      loadVersion += 1;
      editVersion += 1;
      users.value = [];
      hasLoaded.value = false;
      isLoading.value = false;
      isFormOpen.value = false;
      editingUser.value = null;
    },
  );
  onScopeDispose(() => {
    isDisposed = true;
    loadVersion += 1;
    editVersion += 1;
  });

  return {
    users,
    isLoading,
    hasLoaded,
    loadErrors,
    feedbackErrors,
    feedbackMessage,
    isFormOpen,
    editingUser,
    isSaving,
    pendingUserId,
    isEditingStale,
    isBusy,
    loadUsers,
    openCreateForm,
    openEditForm,
    closeForm,
    createUser,
    updateUser,
    deleteUser,
  };
}
