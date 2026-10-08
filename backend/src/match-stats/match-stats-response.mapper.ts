import type { MatchStatsResponseDTO } from './dto/match-stats-response.dto.js';
import type { MatchStats } from './entities/match-stats.entity.js';

// Excluye relaciones ORM y conserva fechas civiles y timestamps ISO UTC.
export function mapMatchStatsResponse(matchStats: MatchStats): MatchStatsResponseDTO {
  return {
    id: matchStats.id,
    date: matchStats.date,
    homeTeamId: matchStats.homeTeamId,
    awayTeamId: matchStats.awayTeamId,
    goalsHomeTeam: matchStats.goalsHomeTeam,
    goalsAwayTeam: matchStats.goalsAwayTeam,
    stadium: matchStats.stadium,
    attendance: matchStats.attendance,
    createdAt: matchStats.createdAt.toISOString(),
    updatedAt: matchStats.updatedAt.toISOString(),
  };
}
