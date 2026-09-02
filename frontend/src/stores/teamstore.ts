import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { TeamInterface } from '@/interfaces/TeamInterface.js';

export const useTeamStore = defineStore('teams', () => {
  const teams = ref<TeamInterface[]>([]);

  function setTeams(newTeams: TeamInterface[]): void {
    teams.value = [...newTeams];
  }

  return { teams, setTeams };
});
