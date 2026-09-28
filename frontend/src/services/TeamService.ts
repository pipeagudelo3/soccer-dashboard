import type { CreateTeamDTO } from '@/dtos/CreateTeamDTO.js';
import type { UpdateTeamDTO } from '@/dtos/UpdateTeamDTO.js';
import type { TeamInterface } from '@/interfaces/TeamInterface.js';
import { AuthService } from '@/services/AuthService.js';
import type { ServiceResult } from '@/services/ServiceResult.js';
import { useMatchStatsStore } from '@/stores/matchstatsstore.js';
import { usePlayerStore } from '@/stores/playerstore.js';
import { useTeamStore } from '@/stores/teamstore.js';
import { generateId } from '@/utils/generateId.js';

export class TeamService {
  static getTeams(): TeamInterface[] {
    return useTeamStore().teams;
  }

  static getTeamById(id: string): TeamInterface | undefined {
    return useTeamStore().teams.find((team) => team.id === id);
  }

  static createTeam(payload: CreateTeamDTO): ServiceResult<TeamInterface> {
    if (!AuthService.isAdmin()) {
      return { success: false, errors: ['Administrator access is required.'] };
    }

    const normalizedPayload = TeamService.normalizePayload(payload);
    const errors = TeamService.validateTeam(normalizedPayload);

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const timestamp = new Date().toISOString();
    const team: TeamInterface = {
      ...normalizedPayload,
      id: generateId('team'),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    useTeamStore().addTeam(team);
    return { success: true, data: team };
  }

  static updateTeam(id: string, payload: UpdateTeamDTO): ServiceResult<TeamInterface> {
    if (!AuthService.isAdmin()) {
      return { success: false, errors: ['Administrator access is required.'] };
    }

    const existingTeam = TeamService.getTeamById(id);
    if (existingTeam === undefined) {
      return { success: false, errors: ['The selected team no longer exists.'] };
    }

    const normalizedPayload = TeamService.normalizePayload({
      name: payload.name ?? existingTeam.name,
      logoURL: payload.logoURL ?? existingTeam.logoURL,
      country: payload.country ?? existingTeam.country,
      stadium: payload.stadium ?? existingTeam.stadium,
      foundedDate: payload.foundedDate ?? existingTeam.foundedDate,
    });
    const errors = TeamService.validateTeam(normalizedPayload, id);

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const updatedTeam: TeamInterface = {
      ...existingTeam,
      ...normalizedPayload,
      updatedAt: new Date().toISOString(),
    };

    useTeamStore().updateTeam(updatedTeam);
    return { success: true, data: updatedTeam };
  }

  static deleteTeam(id: string): ServiceResult<TeamInterface> {
    if (!AuthService.isAdmin()) {
      return { success: false, errors: ['Administrator access is required.'] };
    }

    const existingTeam = TeamService.getTeamById(id);
    if (existingTeam === undefined) {
      return { success: false, errors: ['The selected team no longer exists.'] };
    }

    const hasRecordedMatches = useMatchStatsStore().matchStats.some(
      (matchStats) => matchStats.homeTeamId === id || matchStats.awayTeamId === id,
    );

    if (hasRecordedMatches) {
      return {
        success: false,
        errors: ['This team has recorded match statistics and cannot be deleted.'],
      };
    }

    const playerStore = usePlayerStore();
    const associatedPlayers = playerStore.players.filter((player) => player.teamId === id);

    useTeamStore().removeTeam(id);
    associatedPlayers.forEach((player) => playerStore.updatePlayer({ ...player, teamId: null }));

    return { success: true, data: existingTeam };
  }

  private static normalizePayload(payload: CreateTeamDTO): CreateTeamDTO {
    return {
      name: payload.name.trim(),
      logoURL: payload.logoURL.trim(),
      country: payload.country.trim(),
      stadium: payload.stadium.trim(),
      foundedDate: payload.foundedDate.trim(),
    };
  }

  private static validateTeam(payload: CreateTeamDTO, excludedTeamId?: string): string[] {
    const errors: string[] = [];

    if (payload.name === '') {
      errors.push('Name is required.');
    } else if (TeamService.nameExists(payload.name, excludedTeamId)) {
      errors.push('A team with this name already exists.');
    }

    if (payload.logoURL === '') {
      errors.push('Logo URL is required.');
    } else if (!TeamService.isValidHttpUrl(payload.logoURL)) {
      errors.push('Enter a valid logo URL.');
    }

    if (payload.country === '') {
      errors.push('Country is required.');
    }

    if (payload.stadium === '') {
      errors.push('Stadium is required.');
    }

    if (!TeamService.isValidIsoDate(payload.foundedDate)) {
      errors.push('Enter a valid founding date.');
    } else if (payload.foundedDate > TeamService.getCurrentIsoDate()) {
      errors.push('Founding date cannot be in the future.');
    }

    return errors;
  }

  private static nameExists(name: string, excludedTeamId?: string): boolean {
    const normalizedName = name.toLowerCase();
    return useTeamStore().teams.some(
      (team) => team.id !== excludedTeamId && team.name.trim().toLowerCase() === normalizedName,
    );
  }

  private static isValidHttpUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private static isValidIsoDate(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match === null) {
      return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  private static getCurrentIsoDate(): string {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
