import type { CreateTeamDTO } from '@/dtos/CreateTeamDTO.js';
import type { UpdateTeamDTO } from '@/dtos/UpdateTeamDTO.js';
import type { TeamInterface } from '@/interfaces/TeamInterface.js';
import { useMatchStatsStore } from '@/stores/matchstatsstore.js';
import { usePlayerStore } from '@/stores/playerstore.js';
import { useTeamStore } from '@/stores/teamstore.js';
import { generateId } from '@/utils/generateId.js';

export interface DeleteTeamResult {
  success: boolean;
  message?: string;
}

export class TeamService {
  static getTeams(): TeamInterface[] {
    return useTeamStore().teams;
  }

  static getTeamById(id: string): TeamInterface | undefined {
    return useTeamStore().teams.find((team) => team.id === id);
  }

  static createTeam(payload: CreateTeamDTO): TeamInterface {
    const timestamp = new Date().toISOString();

    const team: TeamInterface = {
      ...payload,
      id: generateId('team'),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    useTeamStore().addTeam(team);

    return team;
  }

  static updateTeam(id: string, payload: UpdateTeamDTO): TeamInterface | undefined {
    const existingTeam = TeamService.getTeamById(id);

    if (existingTeam === undefined) {
      return undefined;
    }

    const updatedTeam: TeamInterface = {
      ...existingTeam,
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    useTeamStore().updateTeam(updatedTeam);

    return updatedTeam;
  }

  static deleteTeam(id: string): DeleteTeamResult {
    // A team referenced by existing match statistics must stay available so that
    // recorded results keep pointing to a real team; deleting it here would silently
    // corrupt match history that this project stage cannot repair.
    const hasRecordedMatches = useMatchStatsStore().matchStats.some(
      (matchStats) => matchStats.homeTeam.id === id || matchStats.awayTeam.id === id,
    );

    if (hasRecordedMatches) {
      return {
        success: false,
        message: 'This team has recorded match statistics and cannot be deleted.',
      };
    }

    useTeamStore().removeTeam(id);

    // Players store a denormalized snapshot of their team, so a deleted team must be
    // cleared from any player still pointing at it.
    usePlayerStore()
      .players.filter((player) => player.team !== null && player.team.id === id)
      .forEach((player) => usePlayerStore().updatePlayer({ ...player, team: null }));

    return { success: true };
  }
}
