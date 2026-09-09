<script setup lang="ts">
import { reactive, watch } from 'vue';

import type { CreateUserDTO } from '@/dtos/CreateUserDTO.js';
import type { UpdateUserDTO } from '@/dtos/UpdateUserDTO.js';
import type { UserInterface } from '@/interfaces/UserInterface.js';

interface Props {
  editingUser: UserInterface | null;
}

interface UserFormState {
  name: string;
  email: string;
  password: string;
  role: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  create: [payload: CreateUserDTO];
  update: [payload: UpdateUserDTO];
  cancel: [];
}>();

function createEmptyForm(): UserFormState {
  return {
    name: '',
    email: '',
    password: '',
    role: 'user',
  };
}

const form = reactive<UserFormState>(createEmptyForm());

watch(
  () => props.editingUser,
  (user) => {
    if (user === null) {
      Object.assign(form, createEmptyForm());
      return;
    }

    Object.assign(form, {
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    });
  },
  { immediate: true },
);

function handleSubmit(): void {
  if (props.editingUser === null) {
    const payload: CreateUserDTO = { ...form };
    emit('create', payload);
    return;
  }

  const payload: UpdateUserDTO = {
    name: form.name,
    email: form.email,
    role: form.role,
  };

  if (form.password !== '') {
    payload.password = form.password;
  }

  emit('update', payload);
}
</script>

<template>
  <form class="user-form" @submit.prevent="handleSubmit">
    <h3>{{ props.editingUser === null ? 'Create user' : 'Edit user' }}</h3>

    <div class="form-grid">
      <label>
        <span>Name</span>
        <input v-model="form.name" type="text" autocomplete="name" required />
      </label>

      <label>
        <span>Email</span>
        <input v-model="form.email" type="email" autocomplete="email" required />
      </label>

      <label>
        <span>Role</span>
        <select v-model="form.role" required>
          <option value="user">User</option>
          <option value="admin">Administrator</option>
        </select>
      </label>

      <label>
        <span>{{ props.editingUser === null ? 'Password' : 'New password' }}</span>
        <input
          v-model="form.password"
          type="password"
          autocomplete="new-password"
          minlength="8"
          :required="props.editingUser === null"
        />
        <small v-if="props.editingUser !== null">Leave blank to keep the current password.</small>
      </label>
    </div>

    <p class="password-help">
      Passwords require at least 8 characters, one uppercase letter, one lowercase letter, and one
      number.
    </p>

    <div class="form-actions">
      <button type="button" class="button-secondary" @click="emit('cancel')">Cancel</button>
      <button type="submit" class="button-primary">
        {{ props.editingUser === null ? 'Create user' : 'Save changes' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.user-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
}

.user-form h3 {
  margin: 0;
  color: #0f172a;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 600;
}

input,
select {
  padding: 0.5rem 0.65rem;
  color: #0f172a;
  font-size: 0.9rem;
  font-weight: 400;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
}

input:focus,
select:focus {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
}

small,
.password-help {
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 400;
}

.password-help {
  margin: 0;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.button-primary,
.button-secondary {
  padding: 0.55rem 1.1rem;
  font-size: 0.875rem;
  font-weight: 600;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  cursor: pointer;
}

.button-primary {
  color: #ffffff;
  background-color: #2563eb;
}

.button-primary:hover {
  background-color: #1d4ed8;
}

.button-secondary {
  color: #475569;
  background-color: #ffffff;
  border-color: #cbd5e1;
}

.button-secondary:hover {
  background-color: #f8fafc;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
