<script setup lang="ts">
import { computed, ref } from 'vue';

import ChartCard from '@/components/ChartCard.vue';
import DataTable from '@/components/DataTable.vue';
import FilterSelect from '@/components/FilterSelect.vue';
import TeamFormPanel from '@/components/TeamFormPanel.vue';
import type { CreateTeamDTO } from '@/dtos/CreateTeamDTO.js';
import type { TeamInterface } from '@/interfaces/TeamInterface.js';
import { PlayerService } from '@/services/PlayerService.js';
import { TeamService } from '@/services/TeamService.js';
import { useAuthStore } from '@/stores/authstore.js';

const authStore = useAuthStore();

const teams = ref<TeamInterface[]>(TeamService.getTeams());
const players = computed(() => PlayerService.getPlayers());

const countryFilter = ref('all');
const isFormOpen = ref(false);
const editingTeam = ref<TeamInterface | null>(null);
const feedbackMessage = ref<string | null>(null);

const countryOptions = computed(() => {
  const countries = [...new Set(teams.value.map((team) => team.country))].sort();
  return [
    { label: 'All countries', value: 'all' },
    ...countries.map((country) => ({ label: country, value: country })),
  ];
});

function playerCountForTeam(teamId: string): number {
  return players.value.filter((player) => player.team?.id === teamId).length;
}

const filteredTeams = computed(() =>
  teams.value.filter(
    (team) => countryFilter.value === 'all' || team.country === countryFilter.value,
  ),
);

const teamColumns = computed(() => [
  { key: 'name', label: 'Team' },
  { key: 'country', label: 'Country' },
  { key: 'stadium', label: 'Stadium' },
  { key: 'foundedDate', label: 'Founded' },
  { key: 'playerCount', label: 'Players', align: 'center' as const },
  ...(authStore.isAdmin ? [{ key: 'actions', label: 'Actions', align: 'right' as const }] : []),
]);

const teamRows = computed(() =>
  filteredTeams.value.map((team) => ({
    id: team.id,
    name: team.name,
    country: team.country,
    stadium: team.stadium,
    foundedDate: team.foundedDate,
    playerCount: playerCountForTeam(team.id),
  })),
);

const playersPerTeamChart = computed(() => ({
  labels: filteredTeams.value.map((team) => team.name),
  datasets: [
    {
      label: 'Players',
      data: filteredTeams.value.map((team) => playerCountForTeam(team.id)),
      backgroundColor: '#0f766e',
      borderRadius: 6,
    },
  ],
}));

function refreshTeams(): void {
  teams.value = TeamService.getTeams();
}

function openCreateForm(): void {
  editingTeam.value = null;
  feedbackMessage.value = null;
  isFormOpen.value = true;
}

function openEditForm(teamId: string): void {
  if (!authStore.isAdmin) {
    return;
  }

  editingTeam.value = TeamService.getTeamById(teamId) ?? null;
  feedbackMessage.value = null;
  isFormOpen.value = true;
}

function closeForm(): void {
  isFormOpen.value = false;
  editingTeam.value = null;
}

function handleSubmit(payload: CreateTeamDTO): void {
  if (editingTeam.value === null) {
    TeamService.createTeam(payload);
  } else {
    TeamService.updateTeam(editingTeam.value.id, payload);
  }

  refreshTeams();
  closeForm();
}

function handleDelete(teamId: string): void {
  if (!authStore.isAdmin) {
    return;
  }

  const team = TeamService.getTeamById(teamId);
  const confirmed = window.confirm(`Delete ${team?.name ?? 'this team'}? This cannot be undone.`);

  if (!confirmed) {
    return;
  }

  const result = TeamService.deleteTeam(teamId);

  if (!result.success) {
    feedbackMessage.value = result.message ?? 'This team could not be deleted.';
    return;
  }

  feedbackMessage.value = null;
  refreshTeams();
}
</script>

<template>
  <div class="teams-view">
    <header class="view-header">
      <div>
        <h1>Teams</h1>
        <p>Browse, filter, and manage the teams competing this season.</p>
      </div>
      <button type="button" class="button-primary" @click="openCreateForm">Add team</button>
    </header>

    <p v-if="feedbackMessage" class="feedback-message" role="alert">{{ feedbackMessage }}</p>

    <TeamFormPanel
      v-if="isFormOpen"
      :editing-team="editingTeam"
      @submit="handleSubmit"
      @cancel="closeForm"
    />

    <section class="filters-bar">
      <FilterSelect v-model="countryFilter" label="Country" :options="countryOptions" />
    </section>

    <ChartCard
      title="Players per team"
      description="Squad size for each team currently visible in the list below."
      type="bar"
      :data="playersPerTeamChart"
      :options="{ plugins: { legend: { display: false } } }"
    />

    <DataTable
      :columns="teamColumns"
      :rows="teamRows"
      row-key="id"
      empty-message="No teams match the selected filter."
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
.teams-view {
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

.feedback-message {
  margin: 0;
  padding: 0.6rem 0.75rem;
  color: #b91c1c;
  font-size: 0.85rem;
  background-color: #fee2e2;
  border-radius: 0.5rem;
}

.filters-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
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
