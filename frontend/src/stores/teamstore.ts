import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { TeamInterface } from '@/interfaces/TeamInterface.js';

export const useTeamStore = defineStore('teams', () => {
  const teams = ref<TeamInterface[]>([]);

  function setTeams(newTeams: TeamInterface[]): void {
    teams.value = [...newTeams];
  }

  function addTeam(team: TeamInterface): void {
    teams.value = [...teams.value, team];
  }

  function updateTeam(updatedTeam: TeamInterface): void {
    teams.value = teams.value.map((team) => (team.id === updatedTeam.id ? updatedTeam : team));
  }

  function removeTeam(teamId: string): void {
    teams.value = teams.value.filter((team) => team.id !== teamId);
  }

  return { teams, setTeams, addTeam, updateTeam, removeTeam };
});
