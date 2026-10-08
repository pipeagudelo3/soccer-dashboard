<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import DataTable from '@/components/DataTable.vue';
import OperationFeedback from '@/components/OperationFeedback.vue';
import PageHeader from '@/components/PageHeader.vue';
import UserFormPanel from '@/components/UserFormPanel.vue';
import { useUserAdministration } from '@/composables/useUserAdministration.js';
import { useAuthStore } from '@/stores/authstore.js';
import { confirmDeletion, showError, showSuccess } from '@/utils/notifications.js';

const authStore = useAuthStore();
const {
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
} = useUserAdministration();
const isConfirmingDeletion = ref(false);
const areActionsDisabled = computed(
  () => isBusy.value || isConfirmingDeletion.value || !authStore.isAdmin,
);

const userColumns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'createdAt', label: 'Created' },
  { key: 'updatedAt', label: 'Updated' },
  { key: 'actions', label: 'Actions', align: 'right' as const },
];
const dateFormatter = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});
const userRows = computed(() =>
  users.value.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === 'admin' ? 'Administrator' : 'User',
    createdAt: dateFormatter.format(new Date(user.createdAt)),
    updatedAt: dateFormatter.format(new Date(user.updatedAt)),
  })),
);

onMounted(() => {
  void loadUsers();
});

async function handleDelete(id: string): Promise<void> {
  if (areActionsDisabled.value) return;
  const user = users.value.find((record) => record.id === id);
  if (user === undefined) return;
  isConfirmingDeletion.value = true;
  try {
    if (!(await confirmDeletion(user.name))) return;
    const result = await deleteUser(id);
    if (!result.success) {
      await showError(result.errors.join(' ') || 'This user could not be deleted.');
      return;
    }
    await showSuccess('User deleted successfully.');
  } finally {
    isConfirmingDeletion.value = false;
  }
}
</script>

<template>
  <div class="admin-users-view">
    <PageHeader
      title="User management"
      description="Create and manage the users authorized to access the dashboard."
    >
      <template #actions>
        <button
          type="button"
          class="button-secondary"
          :disabled="areActionsDisabled"
          @click="loadUsers"
        >
          Reload users
        </button>
        <button
          type="button"
          class="button-primary"
          :disabled="areActionsDisabled"
          @click="openCreateForm"
        >
          Add user
        </button>
      </template>
    </PageHeader>

    <OperationFeedback
      :errors="isFormOpen ? [] : feedbackErrors"
      :success-message="feedbackMessage"
    />

    <UserFormPanel
      v-if="isFormOpen"
      :key="editingUser?.id ?? 'create'"
      :editing-user="editingUser"
      :errors="feedbackErrors"
      :is-submitting="isSaving"
      :is-disabled="isLoading || pendingUserId !== null || isConfirmingDeletion"
      :is-stale="isEditingStale"
      @create="createUser"
      @update="updateUser"
      @cancel="closeForm"
    />

    <div v-if="isEditingStale" class="load-state" role="alert">
      <p>
        This record is no longer available. Your draft remains open; cancel it or reload the record.
      </p>
      <button
        type="button"
        class="button-secondary"
        :disabled="areActionsDisabled"
        @click="editingUser && openEditForm(editingUser.id)"
      >
        Reload selected user
      </button>
    </div>

    <p v-if="isLoading" class="load-state" role="status" aria-live="polite">Loading users...</p>
    <p v-if="pendingUserId" role="status" aria-live="polite">Processing the selected user...</p>
    <div v-if="loadErrors.length > 0" class="load-state" role="alert">
      <OperationFeedback :errors="loadErrors" />
      <p v-if="hasLoaded">Previously loaded data may be outdated.</p>
      <button
        type="button"
        class="button-secondary"
        :disabled="areActionsDisabled"
        @click="loadUsers"
      >
        Retry loading users
      </button>
    </div>

    <DataTable
      v-if="hasLoaded && !isLoading"
      :columns="userColumns"
      :rows="userRows"
      row-key="id"
      caption="User accounts, roles, and account dates"
      empty-message="No users are available."
    >
      <template #cell-role="{ value }">
        <span :class="['role-badge', value === 'Administrator' ? 'role-admin' : 'role-user']">{{
          value
        }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="row-actions">
          <button
            type="button"
            class="link-button"
            :disabled="areActionsDisabled"
            @click="openEditForm(String(row.id))"
          >
            Edit
          </button>
          <button
            type="button"
            class="link-button danger"
            :disabled="areActionsDisabled"
            @click="handleDelete(String(row.id))"
          >
            Delete
          </button>
        </div>
      </template>
    </DataTable>
    <p class="security-note">
      Passwords are never displayed. The server protects the last administrator.
    </p>
  </div>
</template>

<style scoped>
.admin-users-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.button-secondary {
  padding: 0.6rem 1.1rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
}

.load-state {
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
}

.button-primary:disabled,
.button-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-primary {
  padding: 0.6rem 1.1rem;
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 600;
  white-space: nowrap;
  background-color: #2563eb;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
}

.button-primary:hover {
  background-color: #1d4ed8;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.link-button {
  padding: 0;
  color: #2563eb;
  font-size: 0.85rem;
  font-weight: 600;
  background: none;
  border: none;
  cursor: pointer;
}

.link-button:hover:not(:disabled) {
  text-decoration: underline;
}

.link-button.danger {
  color: #dc2626;
}

.link-button:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.role-badge {
  display: inline-flex;
  padding: 0.25rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
}

.role-admin {
  color: #1e40af;
  background-color: #dbeafe;
}

.role-user {
  color: #475569;
  background-color: #f1f5f9;
}

.security-note {
  margin: 0;
  color: #64748b;
  font-size: 0.8rem;
}
</style>
