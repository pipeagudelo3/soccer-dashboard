<script setup lang="ts">
// Focused create/edit form for a single team. Kept separate from TeamsView so
// that view stays responsible for listing, filtering, and orchestration only.
import { reactive, watch } from 'vue';

import type { CreateTeamDTO } from '@/dtos/CreateTeamDTO.js';
import type { TeamInterface } from '@/interfaces/TeamInterface.js';

interface Props {
  editingTeam: TeamInterface | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  submit: [payload: CreateTeamDTO];
  cancel: [];
}>();

function createEmptyForm(): CreateTeamDTO {
  return {
    name: '',
    logoURL: '',
    country: '',
    stadium: '',
    foundedDate: '',
  };
}

const form = reactive<CreateTeamDTO>(createEmptyForm());

watch(
  () => props.editingTeam,
  (team) => {
    Object.assign(form, team === null ? createEmptyForm() : { ...team });
  },
  { immediate: true },
);

function handleSubmit(): void {
  emit('submit', { ...form });
}
</script>

<template>
  <form class="team-form" @submit.prevent="handleSubmit">
    <h3>{{ props.editingTeam === null ? 'Create team' : 'Edit team' }}</h3>

    <div class="form-grid">
      <label>
        <span>Name</span>
        <input v-model="form.name" type="text" required />
      </label>

      <label>
        <span>Country</span>
        <input v-model="form.country" type="text" required />
      </label>

      <label>
        <span>Stadium</span>
        <input v-model="form.stadium" type="text" required />
      </label>

      <label>
        <span>Founded date</span>
        <input v-model="form.foundedDate" type="date" required />
      </label>

      <label class="form-grid-full">
        <span>Logo URL</span>
        <input v-model="form.logoURL" type="url" placeholder="https://..." required />
      </label>
    </div>

    <div class="form-actions">
      <button type="button" class="button-secondary" @click="emit('cancel')">Cancel</button>
      <button type="submit" class="button-primary">
        {{ props.editingTeam === null ? 'Create team' : 'Save changes' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.team-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
}

.team-form h3 {
  margin: 0;
  color: #0f172a;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.form-grid-full {
  grid-column: 1 / -1;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 600;
}

input {
  padding: 0.5rem 0.65rem;
  color: #0f172a;
  font-size: 0.9rem;
  font-weight: 400;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
}

input:focus {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
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
  border-radius: 0.5rem;
  border: 1px solid transparent;
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
