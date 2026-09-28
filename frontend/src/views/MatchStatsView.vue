<script setup lang="ts">
import { computed, ref } from 'vue';

import ChartCard from '@/components/ChartCard.vue';
import DataTable from '@/components/DataTable.vue';
import FilterSelect from '@/components/FilterSelect.vue';
import PageHeader from '@/components/PageHeader.vue';
import { MatchStatsService } from '@/services/MatchStatsService.js';
import { TeamService } from '@/services/TeamService.js';

const matchStats = computed(() => MatchStatsService.getMatchStats());
const teams = computed(() => TeamService.getTeams());
const teamsById = computed(() => new Map(teams.value.map((team) => [team.id, team])));

function getTeamName(teamId: string): string {
  return teamsById.value.get(teamId)?.name ?? 'Unknown team';
}

const teamFilter = ref('all');
const stadiumFilter = ref('all');
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

const stadiumOptions = computed(() => {
  const stadiums = [...new Set(matchStats.value.map((match) => match.stadium))].sort();

  return [
    { label: 'All stadiums', value: 'all' },
    ...stadiums.map((stadium) => ({ label: stadium, value: stadium })),
  ];
});

const filteredMatchStats = computed(() =>
  matchStats.value.filter((match) => {
    const matchesTeam =
      teamFilter.value === 'all' ||
      match.homeTeamId === teamFilter.value ||
      match.awayTeamId === teamFilter.value;
    const matchesStadium = stadiumFilter.value === 'all' || match.stadium === stadiumFilter.value;
    const matchesStartDate = startDateFilter.value === '' || match.date >= startDateFilter.value;
    const matchesEndDate = endDateFilter.value === '' || match.date <= endDateFilter.value;

    return matchesTeam && matchesStadium && matchesStartDate && matchesEndDate;
  }),
);

const matchColumns = [
  { key: 'date', label: 'Date' },
  { key: 'homeTeam', label: 'Home team' },
  { key: 'awayTeam', label: 'Away team' },
  { key: 'score', label: 'Score', align: 'center' as const },
  { key: 'stadium', label: 'Stadium' },
  { key: 'attendance', label: 'Attendance', align: 'right' as const },
];

const dateFormatter = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const numberFormatter = new Intl.NumberFormat('en');

const matchRows = computed(() =>
  filteredMatchStats.value
    .slice()
    .sort((firstMatch, secondMatch) => secondMatch.date.localeCompare(firstMatch.date))
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

const goalsByTeamChart = computed(() => {
  const goalsByTeamId = new Map<
    string,
    {
      name: string;
      country: string;
      goals: number;
    }
  >();

  function addGoals(teamId: string, goals: number): void {
    const team = teamsById.value.get(teamId);
    const currentTeam = goalsByTeamId.get(teamId);

    goalsByTeamId.set(teamId, {
      name: team?.name ?? 'Unknown team',
      country: team?.country ?? teamId,
      goals: (currentTeam?.goals ?? 0) + goals,
    });
  }

  for (const match of filteredMatchStats.value) {
    addGoals(match.homeTeamId, match.goalsHomeTeam);
    addGoals(match.awayTeamId, match.goalsAwayTeam);
  }

  const teamNameCounts = new Map<string, number>();

  for (const team of goalsByTeamId.values()) {
    teamNameCounts.set(team.name, (teamNameCounts.get(team.name) ?? 0) + 1);
  }

  const sortedTotals = [...goalsByTeamId.values()].sort(
    (firstTeam, secondTeam) => secondTeam.goals - firstTeam.goals,
  );

  return {
    labels: sortedTotals.map((team) =>
      (teamNameCounts.get(team.name) ?? 0) > 1 ? `${team.name} (${team.country})` : team.name,
    ),
    datasets: [
      {
        label: 'Goals',
        data: sortedTotals.map((team) => team.goals),
        backgroundColor: '#2563eb',
        borderRadius: 6,
      },
    ],
  };
});

const resultDistributionChart = computed(() => {
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  for (const match of filteredMatchStats.value) {
    if (match.goalsHomeTeam > match.goalsAwayTeam) {
      homeWins += 1;
    } else if (match.goalsHomeTeam < match.goalsAwayTeam) {
      awayWins += 1;
    } else {
      draws += 1;
    }
  }

  return {
    labels: ['Home wins', 'Draws', 'Away wins'],
    datasets: [
      {
        label: 'Matches',
        data: [homeWins, draws, awayWins],
        backgroundColor: ['#2563eb', '#f59e0b', '#0f766e'],
      },
    ],
  };
});

function clearFilters(): void {
  teamFilter.value = 'all';
  stadiumFilter.value = 'all';
  startDateFilter.value = '';
  endDateFilter.value = '';
}
</script>

<template>
  <div class="match-stats-view">
    <PageHeader
      title="Match statistics"
      description="Analyze match results, goals, stadiums, and attendance."
    >
      <template #actions>
        <span class="result-count">
          {{ filteredMatchStats.length }} of {{ matchStats.length }} matches
        </span>
      </template>
    </PageHeader>

    <section class="filters-bar" aria-label="Match filters">
      <FilterSelect v-model="teamFilter" label="Team" :options="teamOptions" />
      <FilterSelect v-model="stadiumFilter" label="Stadium" :options="stadiumOptions" />
      <label class="date-field">
        <span>From</span>
        <input v-model="startDateFilter" type="date" :max="endDateFilter || undefined" />
      </label>
      <label class="date-field">
        <span>To</span>
        <input v-model="endDateFilter" type="date" :min="startDateFilter || undefined" />
      </label>
      <button type="button" class="clear-button" @click="clearFilters">Clear filters</button>
    </section>

    <section class="charts-grid">
      <ChartCard
        title="Goals by team"
        description="Goals scored by each team in the currently filtered matches."
        type="bar"
        :data="goalsByTeamChart"
        :options="{ plugins: { legend: { display: false } } }"
      />
      <ChartCard
        title="Result distribution"
        description="Home wins, draws, and away wins in the currently filtered matches."
        type="doughnut"
        :data="resultDistributionChart"
      />
    </section>

    <DataTable
      :columns="matchColumns"
      :rows="matchRows"
      row-key="id"
      caption="Filtered match results, stadiums, and attendance"
      empty-message="No matches match the selected filters."
    />
  </div>
</template>

<style scoped>
.match-stats-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.result-count {
  padding: 0.45rem 0.7rem;
  color: #1e40af;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  background-color: #dbeafe;
  border-radius: 9999px;
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
  background-color: #ffffff;
  border: 1px solid #93c5fd;
  border-radius: 0.5rem;
  cursor: pointer;
}

.clear-button:hover {
  background-color: #eff6ff;
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
