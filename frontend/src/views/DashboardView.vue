<script setup lang="ts">
import { computed } from 'vue';

import ChartCard from '@/components/ChartCard.vue';
import DataTable from '@/components/DataTable.vue';
import { MatchStatsService } from '@/services/MatchStatsService.js';
import { PlayerService } from '@/services/PlayerService.js';
import { TeamService } from '@/services/TeamService.js';
import { useAuthStore } from '@/stores/authstore.js';

const authStore = useAuthStore();

const teams = computed(() => TeamService.getTeams());
const players = computed(() => PlayerService.getPlayers());
const matchStats = computed(() => MatchStatsService.getMatchStats());

const totalGoalsScored = computed(() =>
  players.value.reduce((total, player) => total + player.goals, 0),
);

const summaryCards = computed(() => [
  { label: 'Teams', value: teams.value.length },
  { label: 'Players', value: players.value.length },
  { label: 'Recorded matches', value: matchStats.value.length },
  { label: 'Goals scored', value: totalGoalsScored.value },
]);

const goalsByTeamChart = computed(() => {
  const totals = new Map<string, number>();

  for (const player of players.value) {
    if (player.team === null) {
      continue;
    }

    totals.set(player.team.name, (totals.get(player.team.name) ?? 0) + player.goals);
  }

  return {
    labels: [...totals.keys()],
    datasets: [
      {
        label: 'Goals',
        data: [...totals.values()],
        backgroundColor: '#2563eb',
        borderRadius: 6,
      },
    ],
  };
});

const playersByPositionChart = computed(() => {
  const totals = new Map<string, number>();

  for (const player of players.value) {
    totals.set(player.position, (totals.get(player.position) ?? 0) + 1);
  }

  return {
    labels: [...totals.keys()],
    datasets: [
      {
        label: 'Players',
        data: [...totals.values()],
        backgroundColor: ['#2563eb', '#0f766e', '#f59e0b', '#38bdf8', '#ef4444', '#8b5cf6'],
      },
    ],
  };
});

const matchColumns = [
  { key: 'date', label: 'Date' },
  { key: 'homeTeam', label: 'Home team' },
  { key: 'awayTeam', label: 'Away team' },
  { key: 'score', label: 'Score', align: 'center' as const },
  { key: 'stadium', label: 'Stadium' },
];

const matchRows = computed(() =>
  matchStats.value
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((match) => ({
      id: match.id,
      date: match.date,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      score: `${match.goalsHomeTeam} - ${match.goalsAwayTeam}`,
      stadium: match.stadium,
    })),
);
</script>

<template>
  <div class="dashboard-view">
    <header class="dashboard-header">
      <h1>Dashboard</h1>
      <p>Welcome back, {{ authStore.currentUser?.name }}. Here is the current season overview.</p>
    </header>

    <section class="summary-grid">
      <article v-for="card in summaryCards" :key="card.label" class="summary-card">
        <span class="summary-value">{{ card.value }}</span>
        <span class="summary-label">{{ card.label }}</span>
      </article>
    </section>

    <section class="charts-grid">
      <ChartCard
        title="Goals by team"
        description="Total goals scored by each team's roster this season."
        type="bar"
        :data="goalsByTeamChart"
        :options="{ plugins: { legend: { display: false } } }"
      />
      <ChartCard
        title="Players by position"
        description="Distribution of the squad across playing positions."
        type="doughnut"
        :data="playersByPositionChart"
      />
    </section>

    <section class="matches-section">
      <h2>Latest matches</h2>
      <DataTable
        :columns="matchColumns"
        :rows="matchRows"
        row-key="id"
        empty-message="No matches recorded yet."
      />
    </section>
  </div>
</template>

<style scoped>
.dashboard-view {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.dashboard-header h1 {
  margin: 0 0 0.35rem;
  color: #0f172a;
}

.dashboard-header p {
  margin: 0;
  color: #64748b;
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
  font-size: 1.75rem;
  font-weight: 700;
  color: #0f172a;
}

.summary-label {
  color: #64748b;
  font-size: 0.85rem;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  gap: 1.25rem;
}

.matches-section h2 {
  margin: 0 0 1rem;
  color: #0f172a;
}
</style>
