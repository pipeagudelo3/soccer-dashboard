import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue';
import type { Ref } from 'vue';

import type { ServiceResult } from '@/services/ServiceResult.js';
import { useAuthStore } from '@/stores/authstore.js';

interface ResourceOperations<T, Create, Update> {
  get(id: string): Promise<ServiceResult<T>>;
  create(payload: Create): Promise<ServiceResult<T>>;
  update(id: string, payload: Update): Promise<ServiceResult<T>>;
  remove(id: string): Promise<ServiceResult<undefined>>;
}

// Shared editor lifecycle for Teams and Players; backend responses own validation and relationships.
export function useResourceAdministration<T extends { id: string; name: string }, Create, Update>(
  records: Ref<T[]>,
  isLoading: Ref<boolean>,
  reload: () => Promise<void>,
  operations: ResourceOperations<T, Create, Update>,
  label: string,
) {
  const authStore = useAuthStore();
  const editingRecord = shallowRef<T | null>(null);
  const isFormOpen = ref(false);
  const isSaving = ref(false);
  const pendingId = ref<string | null>(null);
  const isStale = ref(false);
  const feedbackErrors = ref<string[]>([]);
  const feedbackMessage = ref<string | null>(null);
  const isBusy = computed(() => isLoading.value || isSaving.value || pendingId.value !== null);
  let version = 0;
  let disposed = false;
  const current = (token: string | null, requestVersion: number) =>
    !disposed && token === authStore.accessToken && requestVersion === version;
  function clearFeedback(): void {
    feedbackErrors.value = [];
    feedbackMessage.value = null;
  }
  function closeForm(): void {
    if (isSaving.value || pendingId.value !== null) return;
    version += 1;
    editingRecord.value = null;
    isFormOpen.value = false;
    isStale.value = false;
    feedbackErrors.value = [];
  }
  function openCreateForm(): void {
    if (isBusy.value || !authStore.isAdmin) return;
    closeForm();
    clearFeedback();
    isFormOpen.value = true;
  }
  function missing(id: string): void {
    records.value = records.value.filter((record) => record.id !== id);
    if (editingRecord.value?.id === id) isStale.value = true;
  }
  async function openEditForm(id: string): Promise<void> {
    if (isBusy.value || !authStore.isAdmin) return;
    const requestVersion = ++version;
    const token = authStore.accessToken;
    pendingId.value = id;
    clearFeedback();
    try {
      const result = await operations.get(id);
      if (!current(token, requestVersion)) return;
      if (!result.success) {
        feedbackErrors.value = result.errors;
        if (result.statusCode === 404) missing(id);
        return;
      }
      editingRecord.value = result.data;
      isStale.value = false;
      isFormOpen.value = true;
    } finally {
      if (requestVersion === version) pendingId.value = null;
    }
  }
  async function save(payload: Create & Update): Promise<void> {
    if (isBusy.value || isStale.value || !authStore.isAdmin) return;
    const token = authStore.accessToken;
    const requestVersion = ++version;
    const id = editingRecord.value?.id;
    isSaving.value = true;
    clearFeedback();
    try {
      const result = await (id === undefined
        ? operations.create(payload)
        : operations.update(id, payload));
      if (!current(token, requestVersion)) return;
      if (!result.success) {
        feedbackErrors.value = result.errors;
        if (id !== undefined && result.statusCode === 404) missing(id);
        // Refresh options/relationships without replacing the user's unfinished form.
        if (result.statusCode === 400 || result.statusCode === 409 || result.statusCode === 404)
          await reload();
        return;
      }
      records.value = [
        ...records.value.filter((record) => record.id !== result.data.id),
        result.data,
      ];
      isFormOpen.value = false;
      editingRecord.value = null;
      feedbackMessage.value = `${label} ${id === undefined ? 'created' : 'updated'} successfully.`;
    } finally {
      if (requestVersion === version) isSaving.value = false;
    }
  }
  async function deleteRecord(
    id: string,
    confirm: (name: string) => Promise<boolean>,
  ): Promise<ServiceResult<boolean>> {
    if (isBusy.value || !authStore.isAdmin)
      return { success: false, errors: ['The operation is unavailable. Please try again.'] };
    const token = authStore.accessToken;
    const requestVersion = ++version;
    pendingId.value = id;
    clearFeedback();
    try {
      // Confirmation precedes every request, including any record refresh.
      const confirmed = await confirm(
        records.value.find((record) => record.id === id)?.name ?? `this ${label.toLowerCase()}`,
      );
      if (!current(token, requestVersion) || !authStore.isAdmin)
        return { success: false, errors: ['The session has changed.'] };
      if (!confirmed) return { success: true, data: false };
      const result = await operations.remove(id);
      if (!current(token, requestVersion))
        return { success: false, errors: ['The session has changed.'] };
      if (!result.success) {
        feedbackErrors.value = result.errors;
        if (result.statusCode === 404) missing(id);
        return result;
      }
      missing(id);
      if (editingRecord.value?.id === id) {
        editingRecord.value = null;
        isFormOpen.value = false;
      }
      // Team deletion can detach players. Read the actual relationship changes atomically from REST.
      await reload();
      if (!current(token, requestVersion)) return { success: true, data: true };
      feedbackMessage.value = `${label} deleted successfully.`;
      return { success: true, data: true };
    } finally {
      if (requestVersion === version) pendingId.value = null;
    }
  }
  watch(
    () => [authStore.accessToken, authStore.isAdmin] as const,
    () => {
      version += 1;
      editingRecord.value = null;
      isFormOpen.value = false;
      isStale.value = false;
      isSaving.value = false;
      pendingId.value = null;
      clearFeedback();
      if (authStore.isAuthenticated && !authStore.isAdmin)
        feedbackErrors.value = ['Administrator access is required.'];
    },
  );
  watch(records, () => {
    if (
      editingRecord.value !== null &&
      !records.value.some((record) => record.id === editingRecord.value?.id)
    )
      isStale.value = true;
  });
  onScopeDispose(() => {
    disposed = true;
    version += 1;
  });
  return {
    editingRecord,
    isFormOpen,
    isSaving,
    pendingId,
    isStale,
    feedbackErrors,
    feedbackMessage,
    isBusy,
    openCreateForm,
    openEditForm,
    closeForm,
    save,
    deleteRecord,
  };
}
