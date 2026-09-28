<script setup lang="ts">
import { computed, ref } from 'vue';

import ChartCard from '@/components/ChartCard.vue';
import DataTable from '@/components/DataTable.vue';
import FilterSelect from '@/components/FilterSelect.vue';
import PlayerFormPanel from '@/components/PlayerFormPanel.vue';
import type { CreatePlayerDTO } from '@/dtos/CreatePlayerDTO.js';
import type { PlayerInterface } from '@/interfaces/PlayerInterface.js';
import { PlayerService } from '@/services/PlayerService.js';
import type { ServiceResult } from '@/services/ServiceResult.js';
import { TeamService } from '@/services/TeamService.js';
import { useAuthStore } from '@/stores/authstore.js';

const authStore = useAuthStore();

const players = ref<PlayerInterface[]>(PlayerService.getPlayers());
const teams = computed(() => TeamService.getTeams());
const teamNames = computed(() => new Map(teams.value.map((team) => [team.id, team.name])));

const teamFilter = ref('all');
const positionFilter = ref('all');
const statusFilter = ref('all');
const nameSearch = ref('');

const isFormOpen = ref(false);
const editingPlayer = ref<PlayerInterface | null>(null);
const feedbackErrors = ref<string[]>([]);
const feedbackMessage = ref<string | null>(null);

const teamOptions = computed(() => [
  { label: 'All teams', value: 'all' },
  { label: 'Free agents', value: 'none' },
  ...teams.value.map((team) => ({ label: team.name, value: team.id })),
]);

const positionOptions = computed(() => {
  const positions = [...new Set(players.value.map((player) => player.position))].sort();
  return [
    { label: 'All positions', value: 'all' },
    ...positions.map((position) => ({ label: position, value: position })),
  ];
});

const statusOptions = computed(() => {
  const statuses = [...new Set(players.value.map((player) => player.status))].sort();
  return [
    { label: 'All statuses', value: 'all' },
    ...statuses.map((status) => ({ label: status, value: status })),
  ];
});

const filteredPlayers = computed(() =>
  players.value.filter((player) => {
    const matchesTeam =
      teamFilter.value === 'all' ||
      (teamFilter.value === 'none' ? player.teamId === null : player.teamId === teamFilter.value);
    const matchesPosition =
      positionFilter.value === 'all' || player.position === positionFilter.value;
    const matchesStatus = statusFilter.value === 'all' || player.status === statusFilter.value;
    const matchesName = player.name.toLowerCase().includes(nameSearch.value.trim().toLowerCase());

    return matchesTeam && matchesPosition && matchesStatus && matchesName;
  }),
);

const playerColumns = computed(() => [
  { key: 'name', label: 'Name' },
  { key: 'teamName', label: 'Team' },
  { key: 'position', label: 'Position' },
  { key: 'status', label: 'Status' },
  { key: 'goals', label: 'Goals', align: 'center' as const },
  { key: 'assists', label: 'Assists', align: 'center' as const },
  ...(authStore.isAdmin ? [{ key: 'actions', label: 'Actions', align: 'right' as const }] : []),
]);

const playerRows = computed(() =>
  filteredPlayers.value.map((player) => ({
    id: player.id,
    name: player.name,
    teamName:
      player.teamId === null
        ? 'Free agent'
        : (teamNames.value.get(player.teamId) ?? 'Unknown team'),
    position: player.position,
    status: player.status,
    goals: player.goals,
    assists: player.assists,
  })),
);

const topScorersChart = computed(() => {
  const topScorers = filteredPlayers.value
    .slice()
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 5);

  return {
    labels: topScorers.map((player) => player.name),
    datasets: [
      {
        label: 'Goals',
        data: topScorers.map((player) => player.goals),
        backgroundColor: '#f59e0b',
        borderRadius: 6,
      },
    ],
  };
});

function refreshPlayers(): void {
  players.value = PlayerService.getPlayers();
}

function openCreateForm(): void {
  if (!authStore.isAdmin) {
    return;
  }

  editingPlayer.value = null;
  feedbackErrors.value = [];
  feedbackMessage.value = null;
  isFormOpen.value = true;
}

function openEditForm(playerId: string): void {
  if (!authStore.isAdmin) {
    return;
  }

  editingPlayer.value = PlayerService.getPlayerById(playerId) ?? null;
  feedbackErrors.value = [];
  feedbackMessage.value = null;
  isFormOpen.value = editingPlayer.value !== null;
}

function closeForm(): void {
  isFormOpen.value = false;
  editingPlayer.value = null;
}

function handleResult<T>(result: ServiceResult<T>, successMessage: string): boolean {
  if (!result.success) {
    feedbackErrors.value = result.errors;
    feedbackMessage.value = null;
    return false;
  }

  feedbackErrors.value = [];
  feedbackMessage.value = successMessage;
  refreshPlayers();
  closeForm();
  return true;
}

function handleSubmit(payload: CreatePlayerDTO): void {
  if (editingPlayer.value === null) {
    handleResult(PlayerService.createPlayer(payload), 'Player created successfully.');
    return;
  }

  handleResult(
    PlayerService.updatePlayer(editingPlayer.value.id, payload),
    'Player updated successfully.',
  );
}

function handleDelete(playerId: string): void {
  if (!authStore.isAdmin) {
    return;
  }

  const player = PlayerService.getPlayerById(playerId);
  const confirmed = window.confirm(
    `Delete ${player?.name ?? 'this player'}? This cannot be undone.`,
  );

  if (!confirmed) {
    return;
  }

  handleResult(PlayerService.deletePlayer(playerId), 'Player deleted successfully.');
}
</script>

<template>
  <div class="players-view">
    <header class="view-header">
      <div>
        <h1>Players</h1>
        <p>Filter the roster and manage player records and statistics.</p>
      </div>
      <button v-if="authStore.isAdmin" type="button" class="button-primary" @click="openCreateForm">
        Add player
      </button>
    </header>

    <section v-if="feedbackErrors.length > 0" class="feedback-errors" role="alert">
      <strong>The operation could not be completed:</strong>
      <ul>
        <li v-for="error in feedbackErrors" :key="error">{{ error }}</li>
      </ul>
    </section>

    <p v-if="feedbackMessage" class="feedback-success" role="status">{{ feedbackMessage }}</p>

    <PlayerFormPanel
      v-if="isFormOpen"
      :editing-player="editingPlayer"
      :teams="teams"
      @submit="handleSubmit"
      @cancel="closeForm"
    />

    <section class="filters-bar">
      <FilterSelect v-model="teamFilter" label="Team" :options="teamOptions" />
      <FilterSelect v-model="positionFilter" label="Position" :options="positionOptions" />
      <FilterSelect v-model="statusFilter" label="Status" :options="statusOptions" />
      <label class="search-field">
        <span>Search by name</span>
        <input v-model="nameSearch" type="search" placeholder="Player name" />
      </label>
    </section>

    <ChartCard
      title="Top scorers"
      description="The five highest goal scorers among the currently filtered players."
      type="bar"
      :data="topScorersChart"
      :options="{ plugins: { legend: { display: false } } }"
    />

    <DataTable
      :columns="playerColumns"
      :rows="playerRows"
      row-key="id"
      empty-message="No players match the selected filters."
    >
      <template #cell-actions="{ row }">
        <div class="row-actions">
          <button type="button" class="link-button" @click="openEditForm(String(row.id))">
            Edit
          </button>
          <button type="button" class="link-button danger" @click="handleDelete(String(row.id))">
            Delete
          </button>
        </div>
      </template>
    </DataTable>
  </div>
</template>

<style scoped>
.players-view {
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

.filters-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
}

.search-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 12rem;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 600;
}

.search-field input {
  padding: 0.5rem 0.65rem;
  color: #0f172a;
  font-weight: 400;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
}

.search-field input:focus {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
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

.link-button:hover {
  text-decoration: underline;
}

.link-button.danger {
  color: #dc2626;
}
</style>
