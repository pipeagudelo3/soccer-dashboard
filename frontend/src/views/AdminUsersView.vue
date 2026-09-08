<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import DataTable from '@/components/DataTable.vue';
import UserFormPanel from '@/components/UserFormPanel.vue';
import type { CreateUserDTO } from '@/dtos/CreateUserDTO.js';
import type { UpdateUserDTO } from '@/dtos/UpdateUserDTO.js';
import type { UserInterface } from '@/interfaces/UserInterface.js';
import { UserService, type UserServiceResult } from '@/services/UserService.js';
import { useAuthStore } from '@/stores/authstore.js';

const router = useRouter();
const authStore = useAuthStore();

const users = computed(() => UserService.getUsers());
const isFormOpen = ref(false);
const editingUser = ref<UserInterface | null>(null);
const feedbackErrors = ref<string[]>([]);
const feedbackMessage = ref<string | null>(null);

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

const administratorCount = computed(
  () => users.value.filter((user) => user.role === 'admin').length,
);

const userRows = computed(() =>
  users.value.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === 'admin' ? 'Administrator' : 'User',
    createdAt: dateFormatter.format(new Date(user.createdAt)),
    updatedAt: dateFormatter.format(new Date(user.updatedAt)),
    isLastAdministrator: user.role === 'admin' && administratorCount.value === 1,
  })),
);

function clearFeedback(): void {
  feedbackErrors.value = [];
  feedbackMessage.value = null;
}

function openCreateForm(): void {
  editingUser.value = null;
  clearFeedback();
  isFormOpen.value = true;
}

function openEditForm(userId: string): void {
  editingUser.value = UserService.getUserById(userId) ?? null;
  clearFeedback();
  isFormOpen.value = editingUser.value !== null;
}

function closeForm(): void {
  isFormOpen.value = false;
  editingUser.value = null;
  feedbackErrors.value = [];
}

function handleResult(result: UserServiceResult, successMessage: string): boolean {
  if (!result.success) {
    feedbackErrors.value = result.errors;
    feedbackMessage.value = null;
    return false;
  }

  feedbackErrors.value = [];
  feedbackMessage.value = successMessage;
  isFormOpen.value = false;
  editingUser.value = null;
  return true;
}

function handleCreate(payload: CreateUserDTO): void {
  handleResult(UserService.createUser(payload), 'User created successfully.');
}

async function handleUpdate(payload: UpdateUserDTO): Promise<void> {
  if (editingUser.value === null) {
    return;
  }

  const result = UserService.updateUser(editingUser.value.id, payload);

  if (!handleResult(result, 'User updated successfully.')) {
    return;
  }

  if (!authStore.isAdmin) {
    await router.replace({ name: 'dashboard' });
  }
}

async function handleDelete(userId: string): Promise<void> {
  const user = UserService.getUserById(userId);

  if (user === undefined) {
    feedbackErrors.value = ['The selected user no longer exists.'];
    return;
  }

  const confirmed = window.confirm(`Delete ${user.name}? This cannot be undone.`);

  if (!confirmed) {
    return;
  }

  const result = UserService.deleteUser(userId);

  if (!handleResult(result, 'User deleted successfully.')) {
    return;
  }

  if (result.deletedCurrentUser) {
    await router.replace({ name: 'login' });
  }
}
</script>

<template>
  <div class="admin-users-view">
    <header class="view-header">
      <div>
        <h1>User management</h1>
        <p>Create and manage the users authorized to access the dashboard.</p>
      </div>
      <button type="button" class="button-primary" @click="openCreateForm">Add user</button>
    </header>

    <section v-if="feedbackErrors.length > 0" class="feedback-errors" role="alert">
      <strong>The operation could not be completed:</strong>
      <ul>
        <li v-for="error in feedbackErrors" :key="error">{{ error }}</li>
      </ul>
    </section>

    <p v-if="feedbackMessage" class="feedback-success" role="status">
      {{ feedbackMessage }}
    </p>

    <UserFormPanel
      v-if="isFormOpen"
      :editing-user="editingUser"
      @create="handleCreate"
      @update="handleUpdate"
      @cancel="closeForm"
    />

    <DataTable
      :columns="userColumns"
      :rows="userRows"
      row-key="id"
      empty-message="No users are available."
    >
      <template #cell-role="{ value }">
        <span :class="['role-badge', value === 'Administrator' ? 'role-admin' : 'role-user']">
          {{ value }}
        </span>
      </template>

      <template #cell-actions="{ row }">
        <div class="row-actions">
          <button type="button" class="link-button" @click="openEditForm(String(row.id))">
            Edit
          </button>
          <button
            type="button"
            class="link-button danger"
            :disabled="Boolean(row.isLastAdministrator)"
            :title="
              row.isLastAdministrator ? 'The last administrator cannot be deleted.' : undefined
            "
            @click="handleDelete(String(row.id))"
          >
            Delete
          </button>
        </div>
      </template>
    </DataTable>

    <p class="security-note">
      Passwords are never displayed. At least one administrator must remain in the application.
    </p>
  </div>
</template>

<style scoped>
.admin-users-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.view-header h1 {
  margin: 0 0 0.35rem;
  color: #0f172a;
}

.view-header p {
  margin: 0;
  color: #64748b;
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

.feedback-errors,
.feedback-success {
  margin: 0;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  border-radius: 0.5rem;
}

.feedback-errors {
  color: #b91c1c;
  background-color: #fee2e2;
}

.feedback-errors ul {
  margin: 0.4rem 0 0;
  padding-left: 1.25rem;
}

.feedback-success {
  color: #166534;
  background-color: #dcfce7;
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

@media (max-width: 640px) {
  .view-header {
    flex-direction: column;
  }
}
</style>
