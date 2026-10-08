import { MatchStatsService } from '@/services/MatchStatsService.js';

// Compatibility alias for #53 consumers. MatchStatsService is the single canonical REST implementation.
export class RecordedMatchService {
  static getMatches = MatchStatsService.getMatchStats;
}
