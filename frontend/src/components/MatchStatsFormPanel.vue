<script setup lang="ts">
import { reactive, watch } from 'vue';

import type { CreateMatchStatsDTO } from '@/dtos/CreateMatchStatsDTO.js';
import type { UpdateMatchStatsDTO } from '@/dtos/UpdateMatchStatsDTO.js';
import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';
import type { TeamInterface } from '@/interfaces/TeamInterface.js';

interface Props {
  editingMatchStats: MatchStatsInterface | null;
  teams: TeamInterface[];
}

interface MatchStatsFormState {
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  goalsHomeTeam: number;
  goalsAwayTeam: number;
  stadium: string;
  attendance: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  create: [payload: CreateMatchStatsDTO];
  update: [payload: UpdateMatchStatsDTO];
  invalid: [errors: string[]];
  cancel: [];
}>();

function createEmptyForm(): MatchStatsFormState {
  return {
    date: '',
    homeTeamId: '',
    awayTeamId: '',
    goalsHomeTeam: 0,
    goalsAwayTeam: 0,
    stadium: '',
    attendance: 0,
  };
}

const form = reactive<MatchStatsFormState>(createEmptyForm());

watch(
  () => props.editingMatchStats,
  (matchStats) => {
    if (matchStats === null) {
      Object.assign(form, createEmptyForm());
      return;
    }

    Object.assign(form, {
      date: matchStats.date,
      homeTeamId: matchStats.homeTeam.id,
      awayTeamId: matchStats.awayTeam.id,
      goalsHomeTeam: matchStats.goalsHomeTeam,
      goalsAwayTeam: matchStats.goalsAwayTeam,
      stadium: matchStats.stadium,
      attendance: matchStats.attendance,
    });
  },
  { immediate: true },
);

function handleSubmit(): void {
  const homeTeam = props.teams.find((team) => team.id === form.homeTeamId);
  const awayTeam = props.teams.find((team) => team.id === form.awayTeamId);

  if (homeTeam === undefined || awayTeam === undefined) {
    emit('invalid', ['Select an existing home team and away team.']);
    return;
  }

  const payload: CreateMatchStatsDTO = {
    date: form.date,
    homeTeam,
    awayTeam,
    goalsHomeTeam: form.goalsHomeTeam,
    goalsAwayTeam: form.goalsAwayTeam,
    stadium: form.stadium,
    attendance: form.attendance,
  };

  if (props.editingMatchStats === null) {
    emit('create', payload);
  } else {
    const updatePayload: UpdateMatchStatsDTO = payload;
    emit('update', updatePayload);
  }
}
</script>

<template>
  <form class="match-stats-form" @submit.prevent="handleSubmit">
    <h3>
      {{ props.editingMatchStats === null ? 'Create match statistics' : 'Edit match statistics' }}
    </h3>

    <div class="form-grid">
      <label>
        <span>Date</span>
        <input v-model="form.date" type="date" required />
      </label>

      <label>
        <span>Stadium</span>
        <input v-model="form.stadium" type="text" required />
      </label>

      <label>
        <span>Home team</span>
        <select v-model="form.homeTeamId" required>
          <option value="" disabled>Select a team</option>
          <option
            v-for="team in props.teams"
            :key="team.id"
            :value="team.id"
            :disabled="team.id === form.awayTeamId"
          >
            {{ team.name }}
          </option>
        </select>
      </label>

      <label>
        <span>Away team</span>
        <select v-model="form.awayTeamId" required>
          <option value="" disabled>Select a team</option>
          <option
            v-for="team in props.teams"
            :key="team.id"
            :value="team.id"
            :disabled="team.id === form.homeTeamId"
          >
            {{ team.name }}
          </option>
        </select>
      </label>

      <label>
        <span>Home team goals</span>
        <input v-model.number="form.goalsHomeTeam" type="number" min="0" step="1" required />
      </label>

      <label>
        <span>Away team goals</span>
        <input v-model.number="form.goalsAwayTeam" type="number" min="0" step="1" required />
      </label>

      <label class="form-grid-full">
        <span>Attendance</span>
        <input v-model.number="form.attendance" type="number" min="0" step="1" required />
      </label>
    </div>

    <div class="form-actions">
      <button type="button" class="button-secondary" @click="emit('cancel')">Cancel</button>
      <button type="submit" class="button-primary">
        {{ props.editingMatchStats === null ? 'Create match statistics' : 'Save changes' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.match-stats-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
}

.match-stats-form h3 {
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

  .form-grid-full {
    grid-column: auto;
  }
}
</style>
