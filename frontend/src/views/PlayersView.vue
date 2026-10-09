<script setup lang="ts">
import { computed, ref } from 'vue';

import ApiLoadState from '@/components/ApiLoadState.vue';
import { useTeamPlayerData } from '@/composables/useTeamPlayerData.js';
import { useResourceAdministration } from '@/composables/useResourceAdministration.js';
import ChartCard from '@/components/ChartCard.vue';
import DataTable from '@/components/DataTable.vue';
import FilterSelect from '@/components/FilterSelect.vue';
import OperationFeedback from '@/components/OperationFeedback.vue';
import PageHeader from '@/components/PageHeader.vue';
import PlayerFormPanel from '@/components/PlayerFormPanel.vue';
import type { CreatePlayerDTO } from '@/dtos/CreatePlayerDTO.js';
import type { PlayerInterface } from '@/interfaces/PlayerInterface.js';
import { PlayerService } from '@/services/PlayerService.js';
import { useAuthStore } from '@/stores/authstore.js';
import { confirmDeletion, showError, showSuccess } from '@/utils/notifications.js';

const authStore = useAuthStore();

const { teams, players, isLoading, hasLoaded, loadErrors, isReady, loadData } = useTeamPlayerData();
const {
  editingRecord: editingPlayer,
  isFormOpen,
  isSaving,
  isStale,
  feedbackErrors,
  feedbackMessage,
  isBusy,
  openCreateForm,
  openEditForm,
  closeForm,
  save,
  deleteRecord,
} = useResourceAdministration<PlayerInterface, CreatePlayerDTO, CreatePlayerDTO>(
  players,
  isLoading,
  loadData,
  {
    get: PlayerService.getPlayerById,
    create: PlayerService.createPlayer,
    update: PlayerService.updatePlayer,
    remove: PlayerService.deletePlayer,
  },
  'Player',
);
const teamNames = computed(() => new Map(teams.value.map((team) => [team.id, team.name])));

const teamFilter = ref('all');
const positionFilter = ref('all');
const statusFilter = ref('all');
const nameSearch = ref('');

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

function handleSubmit(payload: CreatePlayerDTO): Promise<void> {
  return save(payload);
}
async function handleDelete(id: string): Promise<void> {
  const result = await deleteRecord(id, confirmDeletion);
  if (!result.success) {
    await showError(result.errors.join(' '));
    return;
  }
  if (result.data) await showSuccess('Player deleted successfully.');
}
</script>

<template>
  <div class="players-view">
    <PageHeader
      title="Players"
      description="Filter the roster and manage player records and statistics."
    >
      <template #actions>
        <button
          v-if="authStore.isAdmin"
          type="button"
          class="button-primary"
          :disabled="isBusy || !isReady"
          @click="openCreateForm"
        >
          Add player
        </button>
      </template>
    </PageHeader>

    <ApiLoadState
      :is-loading="isLoading"
      :errors="loadErrors"
      :has-loaded="hasLoaded"
      :is-empty="players.length === 0"
      @retry="loadData"
    />

    <OperationFeedback
      :errors="isFormOpen ? [] : feedbackErrors"
      :success-message="feedbackMessage"
    />

    <PlayerFormPanel
      v-if="isFormOpen && authStore.isAdmin"
      :editing-player="editingPlayer"
      :is-submitting="isSaving"
      :is-disabled="isBusy || !isReady || !authStore.isAdmin"
      :is-stale="isStale"
      :errors="feedbackErrors"
      :teams="teams"
      @submit="handleSubmit"
      @cancel="closeForm"
    />

    <template v-if="isReady">
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
        caption="Players and their current season contributions"
        empty-message="No players match the selected filters."
      >
        <template #cell-actions="{ row }">
          <div class="row-actions">
            <button
              type="button"
              class="link-button"
              :disabled="isBusy"
              @click="openEditForm(String(row.id))"
            >
              Edit
            </button>
            <button
              type="button"
              class="link-button danger"
              :disabled="isBusy"
              @click="handleDelete(String(row.id))"
            >
              Delete
            </button>
          </div>
        </template>
      </DataTable>
    </template>
  </div>
</template>

<style scoped>
.players-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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
