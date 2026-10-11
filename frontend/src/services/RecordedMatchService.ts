import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';
import { ApiService } from '@/services/ApiService.js';
import { isCount, isId, isRecord, isText, isTimestamp } from '@/services/RestResource.js';
import type { ServiceResult } from '@/services/ServiceResult.js';

// Read-only bridge for charts/comparison: backend UUIDs must never be joined to local seeded IDs.
// The separate MatchStats migration owns administration and mutations.
export class RecordedMatchService {
  static async getMatches(): Promise<ServiceResult<MatchStatsInterface[]>> {
    const result = await ApiService.request<unknown>({ url: '/match-stats' });
    if (!result.success) return result;
    if (!Array.isArray(result.data)) return RecordedMatchService.invalid();
    const matches: MatchStatsInterface[] = [];
    for (const value of result.data) {
      if (
        !isRecord(value) ||
        !isId(value.id) ||
        !isText(value.date) ||
        !isId(value.homeTeamId) ||
        !isId(value.awayTeamId) ||
        !isCount(value.goalsHomeTeam) ||
        !isCount(value.goalsAwayTeam) ||
        !isText(value.stadium) ||
        !isCount(value.attendance) ||
        !isTimestamp(value.createdAt) ||
        !isTimestamp(value.updatedAt)
      )
        return RecordedMatchService.invalid();
      matches.push({
        id: value.id,
        date: value.date,
        homeTeamId: value.homeTeamId,
        awayTeamId: value.awayTeamId,
        goalsHomeTeam: value.goalsHomeTeam,
        goalsAwayTeam: value.goalsAwayTeam,
        stadium: value.stadium,
        attendance: value.attendance,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
      });
    }
    return { success: true, data: matches };
  }
  private static invalid(): ServiceResult<never> {
    return { success: false, errors: ['Unable to read the recorded matches. Please retry.'] };
  }
}
