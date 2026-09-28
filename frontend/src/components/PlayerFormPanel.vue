<script setup lang="ts">
import { reactive, watch } from 'vue';

import type { CreatePlayerDTO } from '@/dtos/CreatePlayerDTO.js';
import type { PlayerInterface } from '@/interfaces/PlayerInterface.js';
import type { TeamInterface } from '@/interfaces/TeamInterface.js';

interface PlayerFormState {
  name: string;
  position: string;
  status: string;
  teamId: string;
  goals: number;
  assists: number;
}

const STATUS_OPTIONS = ['active', 'injured', 'suspended', 'free-agent'];

interface Props {
  editingPlayer: PlayerInterface | null;
  teams: TeamInterface[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  submit: [payload: CreatePlayerDTO];
  cancel: [];
}>();

function createEmptyForm(): PlayerFormState {
  return {
    name: '',
    position: '',
    status: 'active',
    teamId: '',
    goals: 0,
    assists: 0,
  };
}

const form = reactive<PlayerFormState>(createEmptyForm());

watch(
  () => props.editingPlayer,
  (player) => {
    if (player === null) {
      Object.assign(form, createEmptyForm());
      return;
    }

    Object.assign(form, { ...player, teamId: player.teamId ?? '' });
  },
  { immediate: true },
);

function handleSubmit(): void {
  const payload: CreatePlayerDTO = {
    name: form.name,
    position: form.position,
    status: form.status,
    teamId: form.teamId === '' ? null : form.teamId,
    goals: form.goals,
    assists: form.assists,
  };

  emit('submit', payload);
}
</script>

<template>
  <form class="player-form" @submit.prevent="handleSubmit">
    <h3>{{ props.editingPlayer === null ? 'Create player' : 'Edit player' }}</h3>

    <fieldset>
      <legend>Identification</legend>
      <div class="form-grid">
        <label>
          <span>Name</span>
          <input v-model="form.name" type="text" required />
        </label>
        <label>
          <span>Position</span>
          <input v-model="form.position" type="text" required />
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Team & status</legend>
      <div class="form-grid">
        <label>
          <span>Team</span>
          <select v-model="form.teamId">
            <option value="">Free agent (no team)</option>
            <option v-for="team in props.teams" :key="team.id" :value="team.id">
              {{ team.name }}
            </option>
          </select>
        </label>
        <label>
          <span>Status</span>
          <select v-model="form.status">
            <option v-for="status in STATUS_OPTIONS" :key="status" :value="status">
              {{ status }}
            </option>
          </select>
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Performance</legend>
      <div class="form-grid">
        <label>
          <span>Goals</span>
          <input v-model.number="form.goals" type="number" min="0" required />
        </label>
        <label>
          <span>Assists</span>
          <input v-model.number="form.assists" type="number" min="0" required />
        </label>
      </div>
    </fieldset>

    <div class="form-actions">
      <button type="button" class="button-secondary" @click="emit('cancel')">Cancel</button>
      <button type="submit" class="button-primary">
        {{ props.editingPlayer === null ? 'Create player' : 'Save changes' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.player-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.25rem;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
}

.player-form h3 {
  margin: 0;
  color: #0f172a;
}

fieldset {
  padding: 0;
  margin: 0;
  border: none;
}

legend {
  padding: 0 0 0.5rem;
  color: #0f172a;
  font-size: 0.85rem;
  font-weight: 700;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  color: #475569;
  font-size: 0.78rem;
  font-weight: 600;
}

input,
select {
  padding: 0.5rem 0.6rem;
  color: #0f172a;
  font-size: 0.875rem;
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

@media (max-width: 720px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
