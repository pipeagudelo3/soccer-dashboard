<script setup lang="ts">
import { computed } from 'vue';

import ApiLoadState from '@/components/ApiLoadState.vue';
import DataTable from '@/components/DataTable.vue';
import MatchStatsFormPanel from '@/components/MatchStatsFormPanel.vue';
import OperationFeedback from '@/components/OperationFeedback.vue';
import PageHeader from '@/components/PageHeader.vue';
import { useResourceAdministration } from '@/composables/useResourceAdministration.js';
import { useTeamPlayerData } from '@/composables/useTeamPlayerData.js';
import type { CreateMatchStatsDTO } from '@/dtos/CreateMatchStatsDTO.js';
import type { UpdateMatchStatsDTO } from '@/dtos/UpdateMatchStatsDTO.js';
import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';
import { MatchStatsService } from '@/services/MatchStatsService.js';
import { useAuthStore } from '@/stores/authstore.js';
import { confirmDeletion, showError, showSuccess } from '@/utils/notifications.js';

const authStore = useAuthStore();
const { teams, matchStats, isLoading, hasLoaded, loadErrors, isReady, loadData } =
  useTeamPlayerData(true, false);
const teamNames = computed(() => new Map(teams.value.map((team) => [team.id, team.name])));
const getTeamName = (id: string): string => teamNames.value.get(id) ?? 'Unavailable team';
const {
  editingRecord: editingMatchStats,
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
} = useResourceAdministration<MatchStatsInterface, CreateMatchStatsDTO, UpdateMatchStatsDTO>(
  matchStats,
  isLoading,
  loadData,
  {
    get: MatchStatsService.getMatchStatsById,
    create: MatchStatsService.createMatchStats,
    update: MatchStatsService.updateMatchStats,
    remove: MatchStatsService.deleteMatchStats,
  },
  'Match statistics',
  (match) => `${match.date}: ${getTeamName(match.homeTeamId)} vs ${getTeamName(match.awayTeamId)}`,
);

const matchStatsColumns = [
  { key: 'date', label: 'Date' },
  { key: 'homeTeam', label: 'Home team' },
  { key: 'awayTeam', label: 'Away team' },
  { key: 'score', label: 'Score', align: 'center' as const },
  { key: 'stadium', label: 'Stadium' },
  { key: 'attendance', label: 'Attendance', align: 'right' as const },
  { key: 'actions', label: 'Actions', align: 'right' as const },
];
const dateFormatter = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});
const numberFormatter = new Intl.NumberFormat('en');
const matchStatsRows = computed(() =>
  matchStats.value
    .slice()
    .sort((first, second) => second.date.localeCompare(first.date))
    .map((match) => ({
      id: match.id,
      date: dateFormatter.format(new Date(`${match.date}T00:00:00`)),
      homeTeam: getTeamName(match.homeTeamId),
      awayTeam: getTeamName(match.awayTeamId),
      score: `${match.goalsHomeTeam} - ${match.goalsAwayTeam}`,
      stadium: match.stadium,
      attendance: numberFormatter.format(match.attendance),
    })),
);
function handleSubmit(payload: CreateMatchStatsDTO): Promise<void> {
  return save(payload);
}
async function handleDelete(id: string): Promise<void> {
  const result = await deleteRecord(id, confirmDeletion);
  if (!result.success) {
    await showError(result.errors.join(' '));
    return;
  }
  if (result.data) await showSuccess('Match statistics deleted successfully.');
}
</script>

<template>
  <div class="admin-match-stats-view">
    <PageHeader
      title="Match statistics management"
      description="Create and manage the database match records used by the dashboard analysis."
    >
      <template #actions>
        <button
          type="button"
          class="button-primary"
          :disabled="teams.length < 2 || isBusy || !isReady"
          v-if="authStore.isAdmin"
          @click="openCreateForm"
        >
          Add match statistics
        </button>
        <button type="button" class="button-primary" :disabled="isBusy" @click="loadData">
          Reload matches
        </button>
      </template>
    </PageHeader>
    <ApiLoadState
      :is-loading="isLoading"
      :errors="loadErrors"
      :has-loaded="hasLoaded"
      :is-empty="matchStats.length === 0"
      @retry="loadData"
    />
    <OperationFeedback
      :errors="isFormOpen ? [] : feedbackErrors"
      :success-message="feedbackMessage"
    />
    <MatchStatsFormPanel
      v-if="isFormOpen && authStore.isAdmin"
      :editing-match-stats="editingMatchStats"
      :teams="teams"
      :is-submitting="isSaving"
      :is-disabled="isBusy || !isReady || !authStore.isAdmin"
      :is-stale="isStale"
      :errors="feedbackErrors"
      @submit="handleSubmit"
      @cancel="closeForm"
    />
    <template v-if="isReady">
      <p v-if="teams.length < 2" class="feedback-warning" role="status">
        At least two teams are required before match statistics can be created.
      </p>

      <DataTable
        :columns="matchStatsColumns"
        :rows="matchStatsRows"
        row-key="id"
        caption="Recorded match statistics available for administration"
        empty-message="No match statistics are available."
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

      <p class="persistence-note">
        Changes are saved in the database and reflected in the analytical pages.
      </p>
    </template>
  </div>
</template>

<style scoped>
.admin-match-stats-view {
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

.button-primary:hover:not(:disabled) {
  background-color: #1d4ed8;
}

.button-primary:disabled {
  color: #cbd5e1;
  background-color: #64748b;
  cursor: not-allowed;
}

.feedback-warning {
  margin: 0;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  border-radius: 0.5rem;
}

.feedback-warning {
  color: #92400e;
  background-color: #fef3c7;
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

.persistence-note {
  margin: 0;
  color: #64748b;
  font-size: 0.8rem;
}
</style>
