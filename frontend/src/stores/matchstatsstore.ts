import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';

export const useMatchStatsStore = defineStore('matchStats', () => {
  const matchStats = ref<MatchStatsInterface[]>([]);

  function setMatchStats(newMatchStats: MatchStatsInterface[]): void {
    matchStats.value = [...newMatchStats];
  }

  function addMatchStats(newMatchStats: MatchStatsInterface): void {
    matchStats.value = [...matchStats.value, newMatchStats];
  }

  function updateMatchStats(updatedMatchStats: MatchStatsInterface): void {
    matchStats.value = matchStats.value.map((currentMatchStats) =>
      currentMatchStats.id === updatedMatchStats.id ? updatedMatchStats : currentMatchStats,
    );
  }

  function removeMatchStats(matchStatsId: string): void {
    matchStats.value = matchStats.value.filter(
      (currentMatchStats) => currentMatchStats.id !== matchStatsId,
    );
  }

  return { matchStats, setMatchStats, addMatchStats, updateMatchStats, removeMatchStats };
});
