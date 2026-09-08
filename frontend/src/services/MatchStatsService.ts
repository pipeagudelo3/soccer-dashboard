import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';
import { useMatchStatsStore } from '@/stores/matchstatsstore.js';

// Read-only for now: creating and editing match statistics is a separate,
// not-yet-implemented user story.
export class MatchStatsService {
  static getMatchStats(): MatchStatsInterface[] {
    return useMatchStatsStore().matchStats;
  }
}
