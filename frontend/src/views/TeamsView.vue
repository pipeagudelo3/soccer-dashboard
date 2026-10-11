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
import TeamFormPanel from '@/components/TeamFormPanel.vue';
import type { CreateTeamDTO } from '@/dtos/CreateTeamDTO.js';
import type { TeamInterface } from '@/interfaces/TeamInterface.js';
import { TeamService } from '@/services/TeamService.js';
import { useAuthStore } from '@/stores/authstore.js';
import { confirmDeletion, showError, showSuccess } from '@/utils/notifications.js';

const authStore = useAuthStore();

const { teams, players, isLoading, hasLoaded, loadErrors, isReady, loadData } = useTeamPlayerData();
const {
  editingRecord: editingTeam,
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
} = useResourceAdministration<TeamInterface, CreateTeamDTO, CreateTeamDTO>(
  teams,
  isLoading,
  loadData,
  {
    get: TeamService.getTeamById,
    create: TeamService.createTeam,
    update: TeamService.updateTeam,
    remove: TeamService.deleteTeam,
  },
  'Team',
);
const countryFilter = ref('all');
const countryOptions = computed(() => {
  const countries = [...new Set(teams.value.map((team) => team.country))].sort();
  return [
    { label: 'All countries', value: 'all' },
    ...countries.map((country) => ({ label: country, value: country })),
  ];
});

function playerCountForTeam(teamId: string): number {
  return players.value.filter((player) => player.teamId === teamId).length;
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

function handleSubmit(payload: CreateTeamDTO): Promise<void> {
  return save(payload);
}
async function handleDelete(id: string): Promise<void> {
  const result = await deleteRecord(id, confirmDeletion);
  if (!result.success) {
    await showError(result.errors.join(' '));
    return;
  }
  if (result.data) await showSuccess('Team deleted successfully.');
}
</script>

<template>
  <div class="teams-view">
    <PageHeader
      title="Teams"
      description="Browse, filter, and manage the teams competing this season."
    >
      <template #actions>
        <button
          v-if="authStore.isAdmin"
          type="button"
          class="button-primary"
          :disabled="isBusy || !isReady"
          @click="openCreateForm"
        >
          Add team
        </button>
      </template>
    </PageHeader>

    <ApiLoadState
      :is-loading="isLoading"
      :errors="loadErrors"
      :has-loaded="hasLoaded"
      :is-empty="teams.length === 0"
      @retry="loadData"
    />

    <OperationFeedback
      :errors="isFormOpen ? [] : feedbackErrors"
      :success-message="feedbackMessage"
    />

    <TeamFormPanel
      v-if="isFormOpen && authStore.isAdmin"
      :editing-team="editingTeam"
      :is-submitting="isSaving"
      :is-disabled="isBusy || !isReady || !authStore.isAdmin"
      :is-stale="isStale"
      :errors="feedbackErrors"
      @submit="handleSubmit"
      @cancel="closeForm"
    />

    <template v-if="isReady">
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
        caption="Teams and their current squad sizes"
        empty-message="No teams match the selected filter."
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
.teams-view {
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
