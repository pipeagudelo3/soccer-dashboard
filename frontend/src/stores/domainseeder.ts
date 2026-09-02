import type { Pinia } from 'pinia';

import { piniaStateKey } from '@/PiniaConfig.js';
import { matchStatsSeedData } from '@/stores/matchstatsseeder.js';
import { useMatchStatsStore } from '@/stores/matchstatsstore.js';
import { playerSeedData } from '@/stores/playerseeder.js';
import { usePlayerStore } from '@/stores/playerstore.js';
import { teamSeedData } from '@/stores/teamseeder.js';
import { useTeamStore } from '@/stores/teamstore.js';
import { userSeedData } from '@/stores/userseeder.js';
import { useUserStore } from '@/stores/userstore.js';

export function seedDomainState(pinia: Pinia): void {
  if (localStorage.getItem(piniaStateKey) !== null) {
    return;
  }

  useUserStore(pinia).setUsers(userSeedData);
  useTeamStore(pinia).setTeams(teamSeedData);
  usePlayerStore(pinia).setPlayers(playerSeedData);
  useMatchStatsStore(pinia).setMatchStats(matchStatsSeedData);
}
