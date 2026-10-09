<script setup lang="ts">
import { computed, ref } from 'vue';

import ApiLoadState from '@/components/ApiLoadState.vue';
import { useTeamPlayerData } from '@/composables/useTeamPlayerData.js';
import DataTable from '@/components/DataTable.vue';
import MatchStatsFormPanel from '@/components/MatchStatsFormPanel.vue';
import OperationFeedback from '@/components/OperationFeedback.vue';
import PageHeader from '@/components/PageHeader.vue';
import type { CreateMatchStatsDTO } from '@/dtos/CreateMatchStatsDTO.js';
import type { UpdateMatchStatsDTO } from '@/dtos/UpdateMatchStatsDTO.js';
import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';
import { MatchStatsService } from '@/services/MatchStatsService.js';
import type { ServiceResult } from '@/services/ServiceResult.js';
import { confirmDeletion, showError, showSuccess } from '@/utils/notifications.js';

const { teams, isLoading, hasLoaded, loadErrors, isReady, loadData } = useTeamPlayerData();

const matchStats = computed(() => MatchStatsService.getMatchStats());
const teamNames = computed(() => new Map(teams.value.map((team) => [team.id, team.name])));

function getTeamName(teamId: string): string {
  return teamNames.value.get(teamId) ?? 'Unknown team';
}

const isFormOpen = ref(false);
const isSaving = ref(false);
const editingMatchStats = ref<MatchStatsInterface | null>(null);
const feedbackErrors = ref<string[]>([]);
const feedbackMessage = ref<string | null>(null);

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
    .sort((firstMatchStats, secondMatchStats) =>
      secondMatchStats.date.localeCompare(firstMatchStats.date),
    )
    .map((currentMatchStats) => ({
      id: currentMatchStats.id,
      date: dateFormatter.format(new Date(`${currentMatchStats.date}T00:00:00`)),
      homeTeam: getTeamName(currentMatchStats.homeTeamId),
      awayTeam: getTeamName(currentMatchStats.awayTeamId),
      score: `${currentMatchStats.goalsHomeTeam} - ${currentMatchStats.goalsAwayTeam}`,
      stadium: currentMatchStats.stadium,
      attendance: numberFormatter.format(currentMatchStats.attendance),
    })),
);

function clearFeedback(): void {
  feedbackErrors.value = [];
  feedbackMessage.value = null;
}

function openCreateForm(): void {
  if (isSaving.value) return;
  editingMatchStats.value = null;
  clearFeedback();
  isFormOpen.value = true;
}

function openEditForm(matchStatsId: string): void {
  if (isSaving.value) return;
  editingMatchStats.value = MatchStatsService.getMatchStatsById(matchStatsId) ?? null;
  clearFeedback();
  isFormOpen.value = editingMatchStats.value !== null;
}

function closeForm(): void {
  if (isSaving.value) return;
  isFormOpen.value = false;
  editingMatchStats.value = null;
  feedbackErrors.value = [];
}

function handleResult<T>(result: ServiceResult<T>, successMessage: string): boolean {
  if (!result.success) {
    feedbackErrors.value = result.errors;
    feedbackMessage.value = null;
    return false;
  }

  feedbackErrors.value = [];
  feedbackMessage.value = successMessage;
  isFormOpen.value = false;
  editingMatchStats.value = null;
  return true;
}

async function handleCreate(payload: CreateMatchStatsDTO): Promise<void> {
  if (isSaving.value || !isReady.value) return;
  isSaving.value = true;
  try {
    handleResult(
      await MatchStatsService.createMatchStats(payload),
      'Match statistics created successfully.',
    );
  } finally {
    isSaving.value = false;
  }
}

async function handleUpdate(payload: UpdateMatchStatsDTO): Promise<void> {
  if (isSaving.value || !isReady.value || editingMatchStats.value === null) return;
  isSaving.value = true;
  try {
    handleResult(
      await MatchStatsService.updateMatchStats(editingMatchStats.value.id, payload),
      'Match statistics updated successfully.',
    );
  } finally {
    isSaving.value = false;
  }
}

function handleInvalid(errors: string[]): void {
  feedbackErrors.value = errors;
  feedbackMessage.value = null;
}

async function handleDelete(matchStatsId: string): Promise<void> {
  if (isSaving.value || !isReady.value) return;
  const currentMatchStats = MatchStatsService.getMatchStatsById(matchStatsId);

  if (currentMatchStats === undefined) {
    await showError('The selected match statistics no longer exist.');
    return;
  }

  const confirmed = await confirmDeletion(
    `${getTeamName(currentMatchStats.homeTeamId)} vs ${getTeamName(currentMatchStats.awayTeamId)}`,
  );

  if (!confirmed) {
    return;
  }

  const result = MatchStatsService.deleteMatchStats(matchStatsId);

  if (!result.success) {
    feedbackErrors.value = [];
    feedbackMessage.value = null;
    await showError(result.errors.join(' ') || 'These match statistics could not be deleted.');
    return;
  }

  feedbackErrors.value = [];
  feedbackMessage.value = null;
  isFormOpen.value = false;
  editingMatchStats.value = null;
  await showSuccess('Match statistics deleted successfully.');
}
</script>

<template>
  <div class="admin-match-stats-view">
    <PageHeader
      title="Match statistics management"
      description="Manage local match records while database administration is being integrated."
    >
      <template #actions>
        <button
          type="button"
          class="button-primary"
          :disabled="teams.length < 2 || isSaving || !isReady"
          @click="openCreateForm"
        >
          Add match statistics
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
    <p role="status">
      Changes on this page are saved only in this browser. They do not change the database matches
      displayed in statistics. Database match administration will be enabled in the next
      integration.
    </p>
    <template v-if="isReady">
      <p v-if="teams.length < 2" class="feedback-warning" role="status">
        At least two teams are required before match statistics can be created.
      </p>

      <OperationFeedback :errors="feedbackErrors" :success-message="feedbackMessage" />

      <MatchStatsFormPanel
        v-if="isFormOpen"
        :editing-match-stats="editingMatchStats"
        :teams="teams"
        :is-submitting="isSaving"
        @create="handleCreate"
        @update="handleUpdate"
        @invalid="handleInvalid"
        @cancel="closeForm"
      />

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
              :disabled="isSaving"
              @click="openEditForm(String(row.id))"
            >
              Edit
            </button>
            <button
              type="button"
              class="link-button danger"
              :disabled="isSaving"
              @click="handleDelete(String(row.id))"
            >
              Delete
            </button>
          </div>
        </template>
      </DataTable>

      <p class="persistence-note">Match edits on this page are stored in this browser.</p>
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
