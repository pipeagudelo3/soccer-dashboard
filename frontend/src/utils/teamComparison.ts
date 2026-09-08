import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';
import type { PlayerInterface } from '@/interfaces/PlayerInterface.js';
import type { TeamInterface } from '@/interfaces/TeamInterface.js';

export type TeamComparisonIndicators = {
  team: TeamInterface;
  playerCount: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  totalAttendance: number;
  averageAttendance: number;
  playerGoals: number;
  playerAssists: number;
};

export function calculateTeamComparisonIndicators(
  team: TeamInterface,
  players: PlayerInterface[],
  matchStats: MatchStatsInterface[],
): TeamComparisonIndicators {
  const teamPlayers = players.filter((player) => player.team?.id === team.id);
  const teamMatches = matchStats.filter(
    (match) => match.homeTeam.id === team.id || match.awayTeam.id === team.id,
  );

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let totalAttendance = 0;

  for (const match of teamMatches) {
    const isHomeTeam = match.homeTeam.id === team.id;
    const teamGoals = isHomeTeam ? match.goalsHomeTeam : match.goalsAwayTeam;
    const opponentGoals = isHomeTeam ? match.goalsAwayTeam : match.goalsHomeTeam;

    goalsFor += teamGoals;
    goalsAgainst += opponentGoals;
    totalAttendance += match.attendance;

    if (teamGoals > opponentGoals) {
      wins += 1;
    } else if (teamGoals < opponentGoals) {
      losses += 1;
    } else {
      draws += 1;
    }
  }

  return {
    team,
    playerCount: teamPlayers.length,
    matchesPlayed: teamMatches.length,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    totalAttendance,
    averageAttendance:
      teamMatches.length === 0 ? 0 : Math.round(totalAttendance / teamMatches.length),
    playerGoals: teamPlayers.reduce((total, player) => total + player.goals, 0),
    playerAssists: teamPlayers.reduce((total, player) => total + player.assists, 0),
  };
}
