<script setup lang="ts">
import { reactive, watch } from 'vue';

import OperationFeedback from '@/components/OperationFeedback.vue';
import type { CreateMatchStatsDTO } from '@/dtos/CreateMatchStatsDTO.js';
import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';
import type { TeamInterface } from '@/interfaces/TeamInterface.js';

interface Props {
  isSubmitting?: boolean;
  isDisabled?: boolean;
  isStale?: boolean;
  errors?: string[];
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

const props = withDefaults(defineProps<Props>(), {
  isSubmitting: false,
  isDisabled: false,
  isStale: false,
  errors: () => [],
});

const emit = defineEmits<{
  submit: [payload: CreateMatchStatsDTO];
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
      homeTeamId: matchStats.homeTeamId,
      awayTeamId: matchStats.awayTeamId,
      goalsHomeTeam: matchStats.goalsHomeTeam,
      goalsAwayTeam: matchStats.goalsAwayTeam,
      stadium: matchStats.stadium,
      attendance: matchStats.attendance,
    });
  },
  { immediate: true },
);

function handleSubmit(): void {
  if (props.isSubmitting || props.isDisabled || props.isStale) return;
  const payload: CreateMatchStatsDTO = {
    date: form.date,
    homeTeamId: form.homeTeamId,
    awayTeamId: form.awayTeamId,
    goalsHomeTeam: form.goalsHomeTeam,
    goalsAwayTeam: form.goalsAwayTeam,
    stadium: form.stadium,
    attendance: form.attendance,
  };

  emit('submit', payload);
}
</script>

<template>
  <form class="match-stats-form" :aria-busy="props.isSubmitting" @submit.prevent="handleSubmit">
    <h3>
      {{ props.editingMatchStats === null ? 'Create match statistics' : 'Edit match statistics' }}
    </h3>

    <OperationFeedback :errors="props.errors" />
    <p v-if="props.isStale" role="alert">
      This match no longer exists. Cancel editing and reload the list.
    </p>
    <div class="form-grid">
      <label>
        <span>Date</span>
        <input
          :disabled="props.isSubmitting || props.isDisabled || props.isStale"
          v-model="form.date"
          type="date"
          required
        />
      </label>

      <label>
        <span>Stadium</span>
        <input
          :disabled="props.isSubmitting || props.isDisabled || props.isStale"
          v-model="form.stadium"
          type="text"
          required
        />
      </label>

      <label>
        <span>Home team</span>
        <select
          :disabled="props.isSubmitting || props.isDisabled || props.isStale"
          v-model="form.homeTeamId"
          required
        >
          <option value="" disabled>Select a team</option>
          <option
            v-if="
              form.homeTeamId !== '' && !props.teams.some((team) => team.id === form.homeTeamId)
            "
            :value="form.homeTeamId"
            disabled
          >
            Selected team is unavailable; choose another team
          </option>
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
        <select
          :disabled="props.isSubmitting || props.isDisabled || props.isStale"
          v-model="form.awayTeamId"
          required
        >
          <option value="" disabled>Select a team</option>
          <option
            v-if="
              form.awayTeamId !== '' && !props.teams.some((team) => team.id === form.awayTeamId)
            "
            :value="form.awayTeamId"
            disabled
          >
            Selected team is unavailable; choose another team
          </option>
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
        <input
          :disabled="props.isSubmitting || props.isDisabled || props.isStale"
          v-model.number="form.goalsHomeTeam"
          type="number"
          min="0"
          step="1"
          required
        />
      </label>

      <label>
        <span>Away team goals</span>
        <input
          :disabled="props.isSubmitting || props.isDisabled || props.isStale"
          v-model.number="form.goalsAwayTeam"
          type="number"
          min="0"
          step="1"
          required
        />
      </label>

      <label class="form-grid-full">
        <span>Attendance</span>
        <input
          :disabled="props.isSubmitting || props.isDisabled || props.isStale"
          v-model.number="form.attendance"
          type="number"
          min="0"
          step="1"
          required
        />
      </label>
    </div>

    <div class="form-actions">
      <button
        type="button"
        class="button-secondary"
        :disabled="props.isSubmitting"
        @click="emit('cancel')"
      >
        Cancel
      </button>
      <button
        type="submit"
        class="button-primary"
        :disabled="props.isSubmitting || props.isDisabled || props.isStale"
      >
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
