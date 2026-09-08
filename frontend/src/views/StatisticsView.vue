<script setup lang="ts">
import { computed, ref } from 'vue';

import ChartCard from '@/components/ChartCard.vue';
import DataTable from '@/components/DataTable.vue';
import FilterSelect from '@/components/FilterSelect.vue';
import { MatchStatsService } from '@/services/MatchStatsService.js';
import { PlayerService } from '@/services/PlayerService.js';

const players = computed(() => PlayerService.getPlayers());
const matchStats = computed(() => MatchStatsService.getMatchStats());

const teamFilter = ref('all');
const positionFilter = ref('all');
const startDateFilter = ref('');
const endDateFilter = ref('');

const teamOptions = computed(() => {
  const teams = new Map<string, string>();

  for (const player of players.value) {
    if (player.team !== null) {
      teams.set(player.team.id, player.team.name);
    }
  }

  for (const match of matchStats.value) {
    teams.set(match.homeTeam.id, match.homeTeam.name);
    teams.set(match.awayTeam.id, match.awayTeam.name);
  }

  return [
    { label: 'All teams', value: 'all' },
    ...[...teams.entries()]
      .sort(([, firstName], [, secondName]) => firstName.localeCompare(secondName))
      .map(([id, name]) => ({ label: name, value: id })),
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
    const matchesTeam = teamFilter.value === 'all' || player.team?.id === teamFilter.value;
    const matchesPosition =
      positionFilter.value === 'all' || player.position === positionFilter.value;

    return matchesTeam && matchesPosition;
  }),
);

const filteredMatchStats = computed(() =>
  matchStats.value.filter((match) => {
    const matchesTeam =
      teamFilter.value === 'all' ||
      match.homeTeam.id === teamFilter.value ||
      match.awayTeam.id === teamFilter.value;
    const matchesStartDate = startDateFilter.value === '' || match.date >= startDateFilter.value;
    const matchesEndDate = endDateFilter.value === '' || match.date <= endDateFilter.value;

    return matchesTeam && matchesStartDate && matchesEndDate;
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

function calculatePercentage(numerator: number, denominator: number): string {
  if (denominator === 0) {
    return '0%';
  }

  return `${Math.round((numerator / denominator) * 100)}%`;
}

const playerColumns = [
  { key: 'name', label: 'Player' },
  { key: 'team', label: 'Team' },
  { key: 'position', label: 'Position' },
  { key: 'goals', label: 'Goals', align: 'center' as const },
  { key: 'assists', label: 'Assists', align: 'center' as const },
  { key: 'yellowCards', label: 'Yellow', align: 'center' as const },
  { key: 'redCards', label: 'Red', align: 'center' as const },
  { key: 'passes', label: 'Passes', align: 'right' as const },
  { key: 'keyPasses', label: 'Key passes', align: 'right' as const },
  { key: 'shots', label: 'Shots', align: 'right' as const },
  { key: 'shotAccuracy', label: 'Shot accuracy', align: 'right' as const },
  { key: 'tackles', label: 'Tackles', align: 'right' as const },
  { key: 'interceptions', label: 'Interceptions', align: 'right' as const },
  { key: 'dribbles', label: 'Dribbles', align: 'right' as const },
  { key: 'dribbleSuccess', label: 'Dribble success', align: 'right' as const },
  { key: 'duels', label: 'Duels W/L', align: 'right' as const },
  { key: 'duelWinRate', label: 'Duel win rate', align: 'right' as const },
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
      team: player.team?.name ?? 'Free agent',
      position: player.position,
      goals: player.goals,
      assists: player.assists,
      yellowCards: player.yellowCards,
      redCards: player.redCards,
      passes: numberFormatter.format(player.passes),
      keyPasses: numberFormatter.format(player.keyPasses),
      shots: numberFormatter.format(player.shots),
      shotAccuracy: calculatePercentage(player.shotsOnTarget, player.shots),
      tackles: numberFormatter.format(player.tackles),
      interceptions: numberFormatter.format(player.interceptions),
      dribbles: numberFormatter.format(player.dribbles),
      dribbleSuccess: `${numberFormatter.format(player.dribblesSuccess)} (${calculatePercentage(player.dribblesSuccess, player.dribbles)})`,
      duels: `${numberFormatter.format(player.duelsWon)} / ${numberFormatter.format(player.duelsLost)}`,
      duelWinRate: calculatePercentage(player.duelsWon, player.duelsWon + player.duelsLost),
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

const defensiveActionsChart = computed(() => {
  const leadingPlayers = filteredPlayers.value
    .slice()
    .sort(
      (firstPlayer, secondPlayer) =>
        secondPlayer.tackles +
        secondPlayer.interceptions -
        (firstPlayer.tackles + firstPlayer.interceptions),
    )
    .slice(0, 8);

  return {
    labels: leadingPlayers.map((player) => player.name),
    datasets: [
      {
        label: 'Tackles',
        data: leadingPlayers.map((player) => player.tackles),
        backgroundColor: '#f59e0b',
        borderRadius: 6,
      },
      {
        label: 'Interceptions',
        data: leadingPlayers.map((player) => player.interceptions),
        backgroundColor: '#7c3aed',
        borderRadius: 6,
      },
    ],
  };
});

const teamMatchRows = computed(() => {
  const teamTotals = new Map<
    string,
    {
      id: string;
      team: string;
      played: number;
      wins: number;
      draws: number;
      losses: number;
      goalsFor: number;
      goalsAgainst: number;
      attendance: number;
    }
  >();

  function getTeamTotals(teamId: string, teamName: string) {
    const existingTotals = teamTotals.get(teamId);

    if (existingTotals !== undefined) {
      return existingTotals;
    }

    const newTotals = {
      id: teamId,
      team: teamName,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      attendance: 0,
    };

    teamTotals.set(teamId, newTotals);
    return newTotals;
  }

  for (const match of filteredMatchStats.value) {
    const homeTotals = getTeamTotals(match.homeTeam.id, match.homeTeam.name);
    const awayTotals = getTeamTotals(match.awayTeam.id, match.awayTeam.name);

    homeTotals.played += 1;
    homeTotals.goalsFor += match.goalsHomeTeam;
    homeTotals.goalsAgainst += match.goalsAwayTeam;
    homeTotals.attendance += match.attendance;

    awayTotals.played += 1;
    awayTotals.goalsFor += match.goalsAwayTeam;
    awayTotals.goalsAgainst += match.goalsHomeTeam;
    awayTotals.attendance += match.attendance;

    if (match.goalsHomeTeam > match.goalsAwayTeam) {
      homeTotals.wins += 1;
      awayTotals.losses += 1;
    } else if (match.goalsHomeTeam < match.goalsAwayTeam) {
      awayTotals.wins += 1;
      homeTotals.losses += 1;
    } else {
      homeTotals.draws += 1;
      awayTotals.draws += 1;
    }
  }

  return [...teamTotals.values()]
    .sort((firstTeam, secondTeam) => {
      const firstPoints = firstTeam.wins * 3 + firstTeam.draws;
      const secondPoints = secondTeam.wins * 3 + secondTeam.draws;
      return secondPoints - firstPoints || secondTeam.goalsFor - firstTeam.goalsFor;
    })
    .map((team) => ({
      ...team,
      attendance: numberFormatter.format(team.attendance),
    }));
});

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
      (match) => `${match.date}: ${match.homeTeam.name} vs ${match.awayTeam.name}`,
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
    <header class="view-header">
      <div>
        <h1>Statistics</h1>
        <p>Explore indicators derived from player records and recorded matches.</p>
      </div>
      <button type="button" class="clear-button" @click="clearFilters">Clear filters</button>
    </header>

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
      Position filters player indicators. Date filters match and team indicators because Player
      stores season totals without a per-match date relationship.
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
        <ChartCard
          title="Defensive actions"
          description="Tackles and interceptions for the leading filtered players."
          type="bar"
          :data="defensiveActionsChart"
        />
      </div>

      <DataTable
        :columns="playerColumns"
        :rows="playerRows"
        row-key="id"
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
        empty-message="No matches match the selected filters."
      />
    </section>
  </div>
</template>

<style scoped>
.statistics-view,
.statistics-section {
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

.view-header h1,
.section-header h2 {
  margin: 0 0 0.35rem;
  color: #0f172a;
}

.view-header p,
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
  .view-header {
    flex-direction: column;
  }

  .filters-bar > * {
    width: 100%;
  }
}
</style>
