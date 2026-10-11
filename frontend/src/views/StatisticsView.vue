<script setup lang="ts">
import { computed, ref } from 'vue';

import ApiLoadState from '@/components/ApiLoadState.vue';
import ChartCard from '@/components/ChartCard.vue';
import DataTable from '@/components/DataTable.vue';
import FilterSelect from '@/components/FilterSelect.vue';
import PageHeader from '@/components/PageHeader.vue';
import { useTeamPlayerData } from '@/composables/useTeamPlayerData.js';
import { calculateTeamMatchRows, filterMatches } from '@/utils/matchAnalytics.js';

const { teams, players, matchStats, isLoading, hasLoaded, loadErrors, isReady, loadData } =
  useTeamPlayerData(true);

const teamsById = computed(() => new Map(teams.value.map((team) => [team.id, team])));

function getTeamName(teamId: string): string {
  return teamsById.value.get(teamId)?.name ?? 'Unknown team';
}

const teamFilter = ref('all');
const positionFilter = ref('all');
const startDateFilter = ref('');
const endDateFilter = ref('');

const teamOptions = computed(() => {
  return [
    { label: 'All teams', value: 'all' },
    ...teams.value
      .slice()
      .sort((firstTeam, secondTeam) => firstTeam.name.localeCompare(secondTeam.name))
      .map((team) => ({ label: team.name, value: team.id })),
  ];
});

const positionOptions = computed(() => {
  const positions = [...new Set(players.value.map((player) => player.position))].sort();

  return [
    { label: 'All positions', value: 'all' },
    ...positions.map((position) => ({ label: position, value: position })),
  ];
});

const filteredPlayers = computed(() =>
  players.value.filter((player) => {
    const matchesTeam = teamFilter.value === 'all' || player.teamId === teamFilter.value;
    const matchesPosition =
      positionFilter.value === 'all' || player.position === positionFilter.value;

    return matchesTeam && matchesPosition;
  }),
);

const filteredMatchStats = computed(() =>
  filterMatches(matchStats.value, {
    teamId: teamFilter.value,
    startDate: startDateFilter.value,
    endDate: endDateFilter.value,
  }),
);

const totalPlayerGoals = computed(() =>
  filteredPlayers.value.reduce((total, player) => total + player.goals, 0),
);

const totalPlayerAssists = computed(() =>
  filteredPlayers.value.reduce((total, player) => total + player.assists, 0),
);

const averageAttendance = computed(() => {
  if (filteredMatchStats.value.length === 0) {
    return 0;
  }

  const totalAttendance = filteredMatchStats.value.reduce(
    (total, match) => total + match.attendance,
    0,
  );

  return Math.round(totalAttendance / filteredMatchStats.value.length);
});

const numberFormatter = new Intl.NumberFormat('en');

const summaryCards = computed(() => [
  { label: 'Filtered players', value: numberFormatter.format(filteredPlayers.value.length) },
  { label: 'Player goals', value: numberFormatter.format(totalPlayerGoals.value) },
  { label: 'Player assists', value: numberFormatter.format(totalPlayerAssists.value) },
  { label: 'Filtered matches', value: numberFormatter.format(filteredMatchStats.value.length) },
  { label: 'Average attendance', value: numberFormatter.format(averageAttendance.value) },
]);

const playerColumns = [
  { key: 'name', label: 'Player' },
  { key: 'team', label: 'Team' },
  { key: 'position', label: 'Position' },
  { key: 'goals', label: 'Goals', align: 'center' as const },
  { key: 'assists', label: 'Assists', align: 'center' as const },
];

const playerRows = computed(() =>
  filteredPlayers.value
    .slice()
    .sort((firstPlayer, secondPlayer) => {
      const firstContributions = firstPlayer.goals + firstPlayer.assists;
      const secondContributions = secondPlayer.goals + secondPlayer.assists;
      return secondContributions - firstContributions;
    })
    .map((player) => ({
      id: player.id,
      name: player.name,
      team: player.teamId === null ? 'Free agent' : getTeamName(player.teamId),
      position: player.position,
      goals: player.goals,
      assists: player.assists,
    })),
);

const playerContributionsChart = computed(() => {
  const leadingPlayers = filteredPlayers.value
    .slice()
    .sort(
      (firstPlayer, secondPlayer) =>
        secondPlayer.goals + secondPlayer.assists - (firstPlayer.goals + firstPlayer.assists),
    )
    .slice(0, 8);

  return {
    labels: leadingPlayers.map((player) => player.name),
    datasets: [
      {
        label: 'Goals',
        data: leadingPlayers.map((player) => player.goals),
        backgroundColor: '#2563eb',
        borderRadius: 6,
      },
      {
        label: 'Assists',
        data: leadingPlayers.map((player) => player.assists),
        backgroundColor: '#0f766e',
        borderRadius: 6,
      },
    ],
  };
});

const teamMatchRows = computed(() =>
  calculateTeamMatchRows(teams.value, filteredMatchStats.value).map((team) => ({
    ...team,
    attendance: numberFormatter.format(team.attendance),
  })),
);

const teamMatchColumns = [
  { key: 'team', label: 'Team' },
  { key: 'played', label: 'Played', align: 'center' as const },
  { key: 'wins', label: 'Wins', align: 'center' as const },
  { key: 'draws', label: 'Draws', align: 'center' as const },
  { key: 'losses', label: 'Losses', align: 'center' as const },
  { key: 'goalsFor', label: 'Goals for', align: 'center' as const },
  { key: 'goalsAgainst', label: 'Goals against', align: 'center' as const },
  { key: 'attendance', label: 'Combined attendance', align: 'right' as const },
];

const goalsByTeamChart = computed(() => ({
  labels: teamMatchRows.value.map((team) => team.team),
  datasets: [
    {
      label: 'Goals for',
      data: teamMatchRows.value.map((team) => team.goalsFor),
      backgroundColor: '#2563eb',
      borderRadius: 6,
    },
    {
      label: 'Goals against',
      data: teamMatchRows.value.map((team) => team.goalsAgainst),
      backgroundColor: '#ef4444',
      borderRadius: 6,
    },
  ],
}));

const attendanceByMatchChart = computed(() => {
  const sortedMatches = filteredMatchStats.value
    .slice()
    .sort((firstMatch, secondMatch) => firstMatch.date.localeCompare(secondMatch.date));

  return {
    labels: sortedMatches.map(
      (match) =>
        `${match.date}: ${getTeamName(match.homeTeamId)} vs ${getTeamName(match.awayTeamId)}`,
    ),
    datasets: [
      {
        label: 'Attendance',
        data: sortedMatches.map((match) => match.attendance),
        borderColor: '#0f766e',
        backgroundColor: 'rgba(15, 118, 110, 0.2)',
        fill: true,
        tension: 0.25,
      },
    ],
  };
});

function clearFilters(): void {
  teamFilter.value = 'all';
  positionFilter.value = 'all';
  startDateFilter.value = '';
  endDateFilter.value = '';
}
</script>

<template>
  <div class="statistics-view">
    <PageHeader
      title="Statistics"
      description="Explore indicators derived from player records and recorded matches."
    >
      <template #actions>
        <button type="button" class="clear-button" @click="clearFilters">Clear filters</button>
      </template>
    </PageHeader>
    <ApiLoadState
      :is-loading="isLoading"
      :errors="loadErrors"
      :has-loaded="hasLoaded"
      :is-empty="players.length === 0 && matchStats.length === 0"
      @retry="loadData"
    />
    <template v-if="isReady">
      <section class="filters-bar" aria-label="Statistics filters">
        <FilterSelect v-model="teamFilter" label="Team" :options="teamOptions" />
        <FilterSelect v-model="positionFilter" label="Player position" :options="positionOptions" />
        <label class="date-field">
          <span>Matches from</span>
          <input v-model="startDateFilter" type="date" :max="endDateFilter || undefined" />
        </label>
        <label class="date-field">
          <span>Matches to</span>
          <input v-model="endDateFilter" type="date" :min="startDateFilter || undefined" />
        </label>
      </section>

      <p class="filter-note">
        Position filters player indicators. Date filters match and team indicators because player
        records contain season totals without a per-match date relationship.
      </p>

      <section class="summary-grid" aria-label="Statistics summary">
        <article v-for="card in summaryCards" :key="card.label" class="summary-card">
          <span class="summary-value">{{ card.value }}</span>
          <span class="summary-label">{{ card.label }}</span>
        </article>
      </section>

      <section class="statistics-section">
        <header class="section-header">
          <h2>Player indicators</h2>
          <p>All values come from the approved Player fields.</p>
        </header>

        <div class="charts-grid">
          <ChartCard
            title="Goal contributions"
            description="Goals and assists for the leading filtered players."
            type="bar"
            :data="playerContributionsChart"
          />
        </div>

        <DataTable
          :columns="playerColumns"
          :rows="playerRows"
          row-key="id"
          caption="Filtered player goals and assists"
          empty-message="No players match the selected filters."
        />
      </section>

      <section class="statistics-section">
        <header class="section-header">
          <h2>Team and match indicators</h2>
          <p>Results, goals, and attendance are calculated exclusively from MatchStats.</p>
        </header>

        <div class="charts-grid">
          <ChartCard
            title="Team goals"
            description="Goals for and against in the currently filtered matches."
            type="bar"
            :data="goalsByTeamChart"
          />
          <ChartCard
            title="Attendance by match"
            description="Attendance trend for the currently filtered matches."
            type="line"
            :data="attendanceByMatchChart"
            :options="{ plugins: { legend: { display: false } } }"
          />
        </div>

        <DataTable
          :columns="teamMatchColumns"
          :rows="teamMatchRows"
          row-key="id"
          caption="Team results, goals, and attendance from filtered matches"
          empty-message="No matches match the selected filters."
        />
      </section>
    </template>
  </div>
</template>

<style scoped>
.statistics-view,
.statistics-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-header h2 {
  margin: 0 0 0.35rem;
  color: #0f172a;
}

.section-header p {
  margin: 0;
  color: #64748b;
}

.filters-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
}

.date-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 10rem;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 600;
}

.date-field input {
  min-height: 2.2rem;
  padding: 0.5rem 0.65rem;
  color: #0f172a;
  font: inherit;
  font-weight: 400;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
}

.date-field input:focus {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
}

.clear-button {
  min-height: 2.2rem;
  padding: 0.5rem 0.8rem;
  color: #2563eb;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  background-color: #ffffff;
  border: 1px solid #93c5fd;
  border-radius: 0.5rem;
  cursor: pointer;
}

.clear-button:hover {
  background-color: #eff6ff;
}

.filter-note {
  margin: -0.5rem 0 0;
  padding: 0.75rem 1rem;
  color: #475569;
  font-size: 0.85rem;
  background-color: #f8fafc;
  border-left: 3px solid #2563eb;
  border-radius: 0.25rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 1rem;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1.25rem;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
}

.summary-value {
  color: #0f172a;
  font-size: 1.6rem;
  font-weight: 700;
}

.summary-label {
  color: #64748b;
  font-size: 0.85rem;
}

.statistics-section {
  padding-top: 0.5rem;
}

.section-header {
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: 1.25rem;
}

@media (max-width: 700px) {
  .filters-bar > * {
    width: 100%;
  }
}
</style>
