import { computed, onScopeDispose, ref, watch } from 'vue';

import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';
import type { PlayerInterface } from '@/interfaces/PlayerInterface.js';
import type { TeamInterface } from '@/interfaces/TeamInterface.js';
import { PlayerService } from '@/services/PlayerService.js';
import { RecordedMatchService } from '@/services/RecordedMatchService.js';
import { TeamService } from '@/services/TeamService.js';
import { useAuthStore } from '@/stores/authstore.js';

// Page snapshots are disposable, never a second persisted database or a fallback to seeders.
export function useTeamPlayerData(includeMatches = false) {
  const authStore = useAuthStore();
  const teams = ref<TeamInterface[]>([]);
  const players = ref<PlayerInterface[]>([]);
  const matchStats = ref<MatchStatsInterface[]>([]);
  const isLoading = ref(false);
  const hasLoaded = ref(false);
  const loadErrors = ref<string[]>([]);
  const isReady = computed(
    () =>
      hasLoaded.value &&
      !isLoading.value &&
      loadErrors.value.length === 0 &&
      authStore.isAuthenticated,
  );
  let version = 0;
  let disposed = false;

  async function loadData(): Promise<void> {
    if (!authStore.isAuthenticated) return;
    const requestVersion = ++version;
    const token = authStore.accessToken;
    isLoading.value = true;
    loadErrors.value = [];
    try {
      const [teamResult, playerResult, matchResult] = await Promise.all([
        TeamService.getTeams(),
        PlayerService.getPlayers(),
        includeMatches
          ? RecordedMatchService.getMatches()
          : Promise.resolve({ success: true as const, data: [] as MatchStatsInterface[] }),
      ]);
      if (
        disposed ||
        requestVersion !== version ||
        token !== authStore.accessToken ||
        !authStore.isAuthenticated
      )
        return;
      if (!teamResult.success || !playerResult.success || !matchResult.success) {
        loadErrors.value = [
          ...new Set(
            [teamResult, playerResult, matchResult].flatMap((result) =>
              result.success ? [] : result.errors,
            ),
          ),
        ];
        return;
      }
      // Commit one coherent snapshot; a partial failure must not show invented zero counts.
      teams.value = teamResult.data;
      players.value = playerResult.data;
      matchStats.value = matchResult.data;
      hasLoaded.value = true;
    } finally {
      if (requestVersion === version) isLoading.value = false;
    }
  }
  watch(
    () => [authStore.accessToken, authStore.isAuthenticated] as const,
    () => {
      version += 1;
      teams.value = [];
      players.value = [];
      matchStats.value = [];
      hasLoaded.value = false;
      loadErrors.value = [];
      isLoading.value = false;
      if (authStore.isAuthenticated) void loadData();
    },
    { immediate: true },
  );
  onScopeDispose(() => {
    disposed = true;
    version += 1;
  });
  return { teams, players, matchStats, isLoading, hasLoaded, loadErrors, isReady, loadData };
}
