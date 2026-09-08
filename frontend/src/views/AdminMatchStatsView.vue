<script setup lang="ts">
import { computed, ref } from 'vue';

import DataTable from '@/components/DataTable.vue';
import MatchStatsFormPanel from '@/components/MatchStatsFormPanel.vue';
import type { CreateMatchStatsDTO } from '@/dtos/CreateMatchStatsDTO.js';
import type { UpdateMatchStatsDTO } from '@/dtos/UpdateMatchStatsDTO.js';
import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';
import { MatchStatsService, type MatchStatsServiceResult } from '@/services/MatchStatsService.js';
import { TeamService } from '@/services/TeamService.js';

const matchStats = computed(() => MatchStatsService.getMatchStats());
const teams = computed(() => TeamService.getTeams());

const isFormOpen = ref(false);
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
      homeTeam: currentMatchStats.homeTeam.name,
      awayTeam: currentMatchStats.awayTeam.name,
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
  editingMatchStats.value = null;
  clearFeedback();
  isFormOpen.value = true;
}

function openEditForm(matchStatsId: string): void {
  editingMatchStats.value = MatchStatsService.getMatchStatsById(matchStatsId) ?? null;
  clearFeedback();
  isFormOpen.value = editingMatchStats.value !== null;
}

function closeForm(): void {
  isFormOpen.value = false;
  editingMatchStats.value = null;
  feedbackErrors.value = [];
}

function handleResult(result: MatchStatsServiceResult, successMessage: string): boolean {
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

function handleCreate(payload: CreateMatchStatsDTO): void {
  handleResult(
    MatchStatsService.createMatchStats(payload),
    'Match statistics created successfully.',
  );
}

function handleUpdate(payload: UpdateMatchStatsDTO): void {
  if (editingMatchStats.value === null) {
    return;
  }

  handleResult(
    MatchStatsService.updateMatchStats(editingMatchStats.value.id, payload),
    'Match statistics updated successfully.',
  );
}

function handleInvalid(errors: string[]): void {
  feedbackErrors.value = errors;
  feedbackMessage.value = null;
}

function handleDelete(matchStatsId: string): void {
  const currentMatchStats = MatchStatsService.getMatchStatsById(matchStatsId);

  if (currentMatchStats === undefined) {
    feedbackErrors.value = ['The selected match statistics no longer exist.'];
    return;
  }

  const confirmed = window.confirm(
    `Delete ${currentMatchStats.homeTeam.name} vs ${currentMatchStats.awayTeam.name}? This cannot be undone.`,
  );

  if (!confirmed) {
    return;
  }

  handleResult(
    MatchStatsService.deleteMatchStats(matchStatsId),
    'Match statistics deleted successfully.',
  );
}
</script>

<template>
  <div class="admin-match-stats-view">
    <header class="view-header">
      <div>
        <h1>Match statistics management</h1>
        <p>Create and manage the match records used by the dashboard analysis.</p>
      </div>
      <button
        type="button"
        class="button-primary"
        :disabled="teams.length < 2"
        @click="openCreateForm"
      >
        Add match statistics
      </button>
    </header>

    <p v-if="teams.length < 2" class="feedback-warning" role="status">
      At least two teams are required before match statistics can be created.
    </p>

    <section v-if="feedbackErrors.length > 0" class="feedback-errors" role="alert">
      <strong>The operation could not be completed:</strong>
      <ul>
        <li v-for="error in feedbackErrors" :key="error">{{ error }}</li>
      </ul>
    </section>

    <p v-if="feedbackMessage" class="feedback-success" role="status">
      {{ feedbackMessage }}
    </p>

    <MatchStatsFormPanel
      v-if="isFormOpen"
      :editing-match-stats="editingMatchStats"
      :teams="teams"
      @create="handleCreate"
      @update="handleUpdate"
      @invalid="handleInvalid"
      @cancel="closeForm"
    />

    <DataTable
      :columns="matchStatsColumns"
      :rows="matchStatsRows"
      row-key="id"
      empty-message="No match statistics are available."
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

    <p class="persistence-note">
      Changes are synchronized through Pinia and the centralized LocalStorage configuration.
    </p>
  </div>
</template>

<style scoped>
.admin-match-stats-view {
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

.button-primary:hover:not(:disabled) {
  background-color: #1d4ed8;
}

.button-primary:disabled {
  color: #cbd5e1;
  background-color: #64748b;
  cursor: not-allowed;
}

.feedback-errors,
.feedback-success,
.feedback-warning {
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

@media (max-width: 640px) {
  .view-header {
    flex-direction: column;
  }
}
</style>
