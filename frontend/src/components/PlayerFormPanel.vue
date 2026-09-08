<script setup lang="ts">
// Focused create/edit form for a single player. Statistics fields are driven
// by a small config array (STAT_FIELDS) to avoid repeating near-identical
// markup and typing logic for each of the player's numeric stats.
import { reactive, watch } from 'vue';

import type { CreatePlayerDTO } from '@/dtos/CreatePlayerDTO.js';
import type { PlayerInterface } from '@/interfaces/PlayerInterface.js';
import type { TeamInterface } from '@/interfaces/TeamInterface.js';

type PlayerStatKey =
  | 'matchesPlayed'
  | 'minutesPlayed'
  | 'goals'
  | 'assists'
  | 'yellowCards'
  | 'redCards'
  | 'foulsCommitted'
  | 'foulsSuffered'
  | 'passes'
  | 'keyPasses'
  | 'shots'
  | 'shotsOnTarget'
  | 'tackles'
  | 'interceptions'
  | 'dribbles'
  | 'dribblesSuccess'
  | 'duelsWon'
  | 'duelsLost';

interface PlayerFormState {
  name: string;
  imageURL: string;
  position: string;
  dateOfBirth: string;
  nationality: string;
  height: number;
  weight: number;
  jerseyNumber: number;
  status: string;
  teamId: string;
  matchesPlayed: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  foulsCommitted: number;
  foulsSuffered: number;
  passes: number;
  keyPasses: number;
  shots: number;
  shotsOnTarget: number;
  tackles: number;
  interceptions: number;
  dribbles: number;
  dribblesSuccess: number;
  duelsWon: number;
  duelsLost: number;
}

const STAT_FIELDS: { key: PlayerStatKey; label: string }[] = [
  { key: 'matchesPlayed', label: 'Matches played' },
  { key: 'minutesPlayed', label: 'Minutes played' },
  { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'yellowCards', label: 'Yellow cards' },
  { key: 'redCards', label: 'Red cards' },
  { key: 'foulsCommitted', label: 'Fouls committed' },
  { key: 'foulsSuffered', label: 'Fouls suffered' },
  { key: 'passes', label: 'Passes' },
  { key: 'keyPasses', label: 'Key passes' },
  { key: 'shots', label: 'Shots' },
  { key: 'shotsOnTarget', label: 'Shots on target' },
  { key: 'tackles', label: 'Tackles' },
  { key: 'interceptions', label: 'Interceptions' },
  { key: 'dribbles', label: 'Dribbles' },
  { key: 'dribblesSuccess', label: 'Successful dribbles' },
  { key: 'duelsWon', label: 'Duels won' },
  { key: 'duelsLost', label: 'Duels lost' },
];

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
    imageURL: '',
    position: '',
    dateOfBirth: '',
    nationality: '',
    height: 0,
    weight: 0,
    jerseyNumber: 0,
    status: 'active',
    teamId: '',
    matchesPlayed: 0,
    minutesPlayed: 0,
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    foulsCommitted: 0,
    foulsSuffered: 0,
    passes: 0,
    keyPasses: 0,
    shots: 0,
    shotsOnTarget: 0,
    tackles: 0,
    interceptions: 0,
    dribbles: 0,
    dribblesSuccess: 0,
    duelsWon: 0,
    duelsLost: 0,
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

    Object.assign(form, { ...player, teamId: player.team?.id ?? '' });
  },
  { immediate: true },
);

function handleSubmit(): void {
  const { teamId, ...rest } = form;
  const selectedTeam = props.teams.find((team) => team.id === teamId) ?? null;

  const payload: CreatePlayerDTO = {
    ...rest,
    team: selectedTeam,
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
        <label>
          <span>Nationality</span>
          <input v-model="form.nationality" type="text" required />
        </label>
        <label>
          <span>Date of birth</span>
          <input v-model="form.dateOfBirth" type="date" required />
        </label>
        <label class="form-grid-full">
          <span>Image URL</span>
          <input v-model="form.imageURL" type="url" placeholder="https://..." required />
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
        <label>
          <span>Jersey number</span>
          <input v-model.number="form.jerseyNumber" type="number" min="0" required />
        </label>
        <label>
          <span>Height (cm)</span>
          <input v-model.number="form.height" type="number" min="0" required />
        </label>
        <label>
          <span>Weight (kg)</span>
          <input v-model.number="form.weight" type="number" min="0" required />
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Statistics</legend>
      <div class="form-grid form-grid-stats">
        <label v-for="field in STAT_FIELDS" :key="field.key">
          <span>{{ field.label }}</span>
          <input v-model.number="form[field.key]" type="number" min="0" />
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

.form-grid-stats {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.form-grid-full {
  grid-column: 1 / -1;
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
  .form-grid,
  .form-grid-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .form-grid,
  .form-grid-stats {
    grid-template-columns: 1fr;
  }
}
</style>
