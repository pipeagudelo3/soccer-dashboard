<script setup lang="ts">
import { computed, ref } from 'vue';

import ChartCard from '@/components/ChartCard.vue';
import DataTable from '@/components/DataTable.vue';
import FilterSelect from '@/components/FilterSelect.vue';
import { MatchStatsService } from '@/services/MatchStatsService.js';
import { PlayerService } from '@/services/PlayerService.js';
import { TeamService } from '@/services/TeamService.js';
import {
  calculateTeamComparisonIndicators,
  type TeamComparisonIndicators,
} from '@/utils/teamComparison.js';

const teams = computed(() => TeamService.getTeams());
const players = computed(() => PlayerService.getPlayers());
const matchStats = computed(() => MatchStatsService.getMatchStats());

const firstTeamId = ref(teams.value[0]?.id ?? '');
const secondTeamId = ref(teams.value[1]?.id ?? '');

const firstTeamOptions = computed(() => [
  { label: 'Select first team', value: '' },
  ...teams.value
    .filter((team) => team.id !== secondTeamId.value)
    .map((team) => ({ label: team.name, value: team.id })),
]);

const secondTeamOptions = computed(() => [
  { label: 'Select second team', value: '' },
  ...teams.value
    .filter((team) => team.id !== firstTeamId.value)
    .map((team) => ({ label: team.name, value: team.id })),
]);

function getIndicators(teamId: string): TeamComparisonIndicators | null {
  const team = teams.value.find((existingTeam) => existingTeam.id === teamId);

  if (team === undefined) {
    return null;
  }

  return calculateTeamComparisonIndicators(team, players.value, matchStats.value);
}

const firstTeamIndicators = computed(() => getIndicators(firstTeamId.value));
const secondTeamIndicators = computed(() => getIndicators(secondTeamId.value));

const canCompare = computed(
  () =>
    firstTeamId.value !== '' &&
    secondTeamId.value !== '' &&
    firstTeamId.value !== secondTeamId.value &&
    firstTeamIndicators.value !== null &&
    secondTeamIndicators.value !== null,
);

const numberFormatter = new Intl.NumberFormat('en');

function formatGoalDifference(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

const comparisonColumns = computed(() => [
  { key: 'indicator', label: 'Indicator' },
  {
    key: 'firstTeam',
    label: firstTeamIndicators.value?.team.name ?? 'First team',
    align: 'center' as const,
  },
  {
    key: 'secondTeam',
    label: secondTeamIndicators.value?.team.name ?? 'Second team',
    align: 'center' as const,
  },
]);

const comparisonRows = computed(() => {
  const firstTeam = firstTeamIndicators.value;
  const secondTeam = secondTeamIndicators.value;

  if (!canCompare.value || firstTeam === null || secondTeam === null) {
    return [];
  }

  return [
    {
      id: 'country',
      indicator: 'Country',
      firstTeam: firstTeam.team.country,
      secondTeam: secondTeam.team.country,
    },
    {
      id: 'stadium',
      indicator: 'Stadium',
      firstTeam: firstTeam.team.stadium,
      secondTeam: secondTeam.team.stadium,
    },
    {
      id: 'players',
      indicator: 'Players',
      firstTeam: numberFormatter.format(firstTeam.playerCount),
      secondTeam: numberFormatter.format(secondTeam.playerCount),
    },
    {
      id: 'matches',
      indicator: 'Matches played',
      firstTeam: numberFormatter.format(firstTeam.matchesPlayed),
      secondTeam: numberFormatter.format(secondTeam.matchesPlayed),
    },
    {
      id: 'wins',
      indicator: 'Wins',
      firstTeam: numberFormatter.format(firstTeam.wins),
      secondTeam: numberFormatter.format(secondTeam.wins),
    },
    {
      id: 'draws',
      indicator: 'Draws',
      firstTeam: numberFormatter.format(firstTeam.draws),
      secondTeam: numberFormatter.format(secondTeam.draws),
    },
    {
      id: 'losses',
      indicator: 'Losses',
      firstTeam: numberFormatter.format(firstTeam.losses),
      secondTeam: numberFormatter.format(secondTeam.losses),
    },
    {
      id: 'goals-for',
      indicator: 'Match goals for',
      firstTeam: numberFormatter.format(firstTeam.goalsFor),
      secondTeam: numberFormatter.format(secondTeam.goalsFor),
    },
    {
      id: 'goals-against',
      indicator: 'Match goals against',
      firstTeam: numberFormatter.format(firstTeam.goalsAgainst),
      secondTeam: numberFormatter.format(secondTeam.goalsAgainst),
    },
    {
      id: 'goal-difference',
      indicator: 'Goal difference',
      firstTeam: formatGoalDifference(firstTeam.goalDifference),
      secondTeam: formatGoalDifference(secondTeam.goalDifference),
    },
    {
      id: 'total-attendance',
      indicator: 'Combined match attendance',
      firstTeam: numberFormatter.format(firstTeam.totalAttendance),
      secondTeam: numberFormatter.format(secondTeam.totalAttendance),
    },
    {
      id: 'average-attendance',
      indicator: 'Average match attendance',
      firstTeam: numberFormatter.format(firstTeam.averageAttendance),
      secondTeam: numberFormatter.format(secondTeam.averageAttendance),
    },
    {
      id: 'player-goals',
      indicator: 'Player goals',
      firstTeam: numberFormatter.format(firstTeam.playerGoals),
      secondTeam: numberFormatter.format(secondTeam.playerGoals),
    },
    {
      id: 'player-assists',
      indicator: 'Player assists',
      firstTeam: numberFormatter.format(firstTeam.playerAssists),
      secondTeam: numberFormatter.format(secondTeam.playerAssists),
    },
  ];
});

const matchResultsChart = computed(() => {
  const firstTeam = firstTeamIndicators.value;
  const secondTeam = secondTeamIndicators.value;

  return {
    labels: ['Wins', 'Draws', 'Losses'],
    datasets: [
      {
        label: firstTeam?.team.name ?? 'First team',
        data: firstTeam === null ? [0, 0, 0] : [firstTeam.wins, firstTeam.draws, firstTeam.losses],
        backgroundColor: '#2563eb',
        borderRadius: 6,
      },
      {
        label: secondTeam?.team.name ?? 'Second team',
        data:
          secondTeam === null ? [0, 0, 0] : [secondTeam.wins, secondTeam.draws, secondTeam.losses],
        backgroundColor: '#0f766e',
        borderRadius: 6,
      },
    ],
  };
});

const goalsChart = computed(() => {
  const firstTeam = firstTeamIndicators.value;
  const secondTeam = secondTeamIndicators.value;

  return {
    labels: ['Match goals for', 'Match goals against', 'Player goals', 'Player assists'],
    datasets: [
      {
        label: firstTeam?.team.name ?? 'First team',
        data:
          firstTeam === null
            ? [0, 0, 0, 0]
            : [
                firstTeam.goalsFor,
                firstTeam.goalsAgainst,
                firstTeam.playerGoals,
                firstTeam.playerAssists,
              ],
        backgroundColor: '#2563eb',
        borderRadius: 6,
      },
      {
        label: secondTeam?.team.name ?? 'Second team',
        data:
          secondTeam === null
            ? [0, 0, 0, 0]
            : [
                secondTeam.goalsFor,
                secondTeam.goalsAgainst,
                secondTeam.playerGoals,
                secondTeam.playerAssists,
              ],
        backgroundColor: '#0f766e',
        borderRadius: 6,
      },
    ],
  };
});
</script>

<template>
  <div class="team-comparison-view">
    <header class="view-header">
      <h1>Team comparison</h1>
      <p>Compare two teams using their players and recorded match statistics.</p>
    </header>

    <section class="team-selectors" aria-label="Teams to compare">
      <FilterSelect v-model="firstTeamId" label="First team" :options="firstTeamOptions" />
      <span class="versus-label" aria-hidden="true">VS</span>
      <FilterSelect v-model="secondTeamId" label="Second team" :options="secondTeamOptions" />
    </section>

    <p v-if="teams.length < 2" class="feedback-message" role="status">
      At least two teams are required to create a comparison.
    </p>
    <p v-else-if="!canCompare" class="feedback-message" role="status">
      Select two different existing teams to view the comparison.
    </p>

    <template v-if="canCompare">
      <section class="team-headings" aria-label="Selected teams">
        <article class="team-heading">
          <span class="team-order">First team</span>
          <h2>{{ firstTeamIndicators?.team.name }}</h2>
          <p>{{ firstTeamIndicators?.team.country }} · {{ firstTeamIndicators?.team.stadium }}</p>
        </article>
        <article class="team-heading">
          <span class="team-order">Second team</span>
          <h2>{{ secondTeamIndicators?.team.name }}</h2>
          <p>{{ secondTeamIndicators?.team.country }} · {{ secondTeamIndicators?.team.stadium }}</p>
        </article>
      </section>

      <section class="charts-grid">
        <ChartCard
          title="Match results"
          description="Wins, draws, and losses calculated for each selected team."
          type="bar"
          :data="matchResultsChart"
        />
        <ChartCard
          title="Goals and assists"
          description="Match goals and aggregated player contributions."
          type="bar"
          :data="goalsChart"
        />
      </section>

      <DataTable
        :columns="comparisonColumns"
        :rows="comparisonRows"
        row-key="id"
        empty-message="No comparison data is available."
      />
    </template>
  </div>
</template>

<style scoped>
.team-comparison-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.view-header h1 {
  margin: 0 0 0.35rem;
  color: #0f172a;
}

.view-header p {
  margin: 0;
  color: #64748b;
}

.team-selectors {
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) auto minmax(12rem, 1fr);
  align-items: end;
  gap: 1rem;
  padding: 1.25rem;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
}

.team-selectors :deep(.filter-select) {
  width: 100%;
}

.versus-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  color: #1e40af;
  font-size: 0.8rem;
  font-weight: 700;
  background-color: #dbeafe;
  border-radius: 9999px;
}

.feedback-message {
  margin: 0;
  padding: 1rem;
  color: #475569;
  text-align: center;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
}

.team-headings {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.team-heading {
  padding: 1.25rem;
  text-align: center;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-top: 4px solid #2563eb;
  border-radius: 0.75rem;
}

.team-heading:nth-child(2) {
  border-top-color: #0f766e;
}

.team-order {
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.team-heading h2 {
  margin: 0.4rem 0 0.25rem;
  color: #0f172a;
  font-size: 1.25rem;
}

.team-heading p {
  margin: 0;
  color: #64748b;
  font-size: 0.85rem;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: 1.25rem;
}

@media (max-width: 700px) {
  .team-selectors {
    grid-template-columns: 1fr;
  }

  .versus-label {
    justify-self: center;
  }

  .team-headings {
    grid-template-columns: 1fr;
  }
}
</style>
