import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';

export const useMatchStatsStore = defineStore('matchStats', () => {
  const matchStats = ref<MatchStatsInterface[]>([]);

  function setMatchStats(newMatchStats: MatchStatsInterface[]): void {
    matchStats.value = [...newMatchStats];
  }

  return { matchStats, setMatchStats };
});
