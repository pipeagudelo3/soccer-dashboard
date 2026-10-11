import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';
import type { PlayerInterface } from '@/interfaces/PlayerInterface.js';
import type { TeamInterface } from '@/interfaces/TeamInterface.js';
import { calculateTeamComparisonIndicators } from '@/utils/teamComparison.js';

export interface MatchFilters {
  teamId?: string;
  stadium?: string;
  startDate?: string;
  endDate?: string;
}
export function filterMatches(
  matches: MatchStatsInterface[],
  filters: MatchFilters,
): MatchStatsInterface[] {
  return matches.filter(
    (match) =>
      (!filters.teamId ||
        filters.teamId === 'all' ||
        match.homeTeamId === filters.teamId ||
        match.awayTeamId === filters.teamId) &&
      (!filters.stadium || filters.stadium === 'all' || match.stadium === filters.stadium) &&
      (!filters.startDate || match.date >= filters.startDate) &&
      (!filters.endDate || match.date <= filters.endDate),
  );
}
// Statistics and comparison use the same presentation calculation; nothing is persisted as Statistics.
export function calculateTeamMatchRows(teams: TeamInterface[], matches: MatchStatsInterface[]) {
  return teams
    .map((team) => calculateTeamComparisonIndicators(team, [], matches))
    .filter((indicators) => indicators.matchesPlayed > 0)
    .sort(
      (first, second) =>
        second.wins * 3 + second.draws - (first.wins * 3 + first.draws) ||
        second.goalsFor - first.goalsFor,
    )
    .map((indicators) => ({
      id: indicators.team.id,
      team: indicators.team.name,
      played: indicators.matchesPlayed,
      wins: indicators.wins,
      draws: indicators.draws,
      losses: indicators.losses,
      goalsFor: indicators.goalsFor,
      goalsAgainst: indicators.goalsAgainst,
      attendance: indicators.totalAttendance,
    }));
}
export function calculateMatchGoals(teams: TeamInterface[], matches: MatchStatsInterface[]) {
  const byId = new Map(teams.map((team) => [team.id, team]));
  const totals = calculateTeamMatchRows(teams, matches).sort(
    (first, second) => second.goalsFor - first.goalsFor,
  );
  const nameCounts = new Map<string, number>();
  for (const total of totals) nameCounts.set(total.team, (nameCounts.get(total.team) ?? 0) + 1);
  return {
    labels: totals.map((total) =>
      (nameCounts.get(total.team) ?? 0) > 1
        ? `${total.team} (${byId.get(total.id)?.country ?? total.id})`
        : total.team,
    ),
    goals: totals.map((total) => total.goalsFor),
  };
}
export function calculateResultDistribution(matches: MatchStatsInterface[]): number[] {
  if (matches.length === 0) return [];
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  for (const match of matches) {
    if (match.goalsHomeTeam > match.goalsAwayTeam) homeWins += 1;
    else if (match.goalsHomeTeam < match.goalsAwayTeam) awayWins += 1;
    else draws += 1;
  }
  return [homeWins, draws, awayWins];
}
export function calculateRosterGoals(teams: TeamInterface[], players: PlayerInterface[]) {
  return teams
    .map((team) => ({
      team: team.name,
      players: players.filter((player) => player.teamId === team.id),
    }))
    .filter((group) => group.players.length > 0)
    .map((group) => ({
      team: group.team,
      goals: group.players.reduce((total, player) => total + player.goals, 0),
    }));
}
