import type { CreatePlayerDTO } from '@/dtos/CreatePlayerDTO.js';
import type { UpdatePlayerDTO } from '@/dtos/UpdatePlayerDTO.js';
import type { PlayerInterface } from '@/interfaces/PlayerInterface.js';
import { AuthService } from '@/services/AuthService.js';
import type { ServiceResult } from '@/services/ServiceResult.js';
import { TeamService } from '@/services/TeamService.js';
import { usePlayerStore } from '@/stores/playerstore.js';
import { generateId } from '@/utils/generateId.js';

const ACCEPTED_PLAYER_STATUSES = ['active', 'injured', 'suspended', 'free-agent'];

export class PlayerService {
  static getPlayers(): PlayerInterface[] {
    return usePlayerStore().players;
  }

  static getPlayerById(id: string): PlayerInterface | undefined {
    return usePlayerStore().players.find((player) => player.id === id);
  }

  static createPlayer(payload: CreatePlayerDTO): ServiceResult<PlayerInterface> {
    if (!AuthService.isAdmin()) {
      return { success: false, errors: ['Administrator access is required.'] };
    }

    const normalizedPayload = PlayerService.normalizePayload(payload);
    const errors = PlayerService.validatePlayer(normalizedPayload);
    if (errors.length > 0) {
      return { success: false, errors };
    }

    const timestamp = new Date().toISOString();
    const player: PlayerInterface = {
      ...normalizedPayload,
      id: generateId('player'),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    usePlayerStore().addPlayer(player);
    return { success: true, data: player };
  }

  static updatePlayer(id: string, payload: UpdatePlayerDTO): ServiceResult<PlayerInterface> {
    if (!AuthService.isAdmin()) {
      return { success: false, errors: ['Administrator access is required.'] };
    }

    const existingPlayer = PlayerService.getPlayerById(id);
    if (existingPlayer === undefined) {
      return { success: false, errors: ['The selected player no longer exists.'] };
    }

    const normalizedPayload = PlayerService.normalizePayload({
      name: payload.name ?? existingPlayer.name,
      position: payload.position ?? existingPlayer.position,
      status: payload.status ?? existingPlayer.status,
      teamId: payload.teamId === undefined ? existingPlayer.teamId : payload.teamId,
      goals: payload.goals ?? existingPlayer.goals,
      assists: payload.assists ?? existingPlayer.assists,
    });
    const errors = PlayerService.validatePlayer(normalizedPayload);
    if (errors.length > 0) {
      return { success: false, errors };
    }

    const updatedPlayer: PlayerInterface = {
      ...existingPlayer,
      ...normalizedPayload,
      updatedAt: new Date().toISOString(),
    };

    usePlayerStore().updatePlayer(updatedPlayer);
    return { success: true, data: updatedPlayer };
  }

  static deletePlayer(id: string): ServiceResult<PlayerInterface> {
    if (!AuthService.isAdmin()) {
      return { success: false, errors: ['Administrator access is required.'] };
    }

    const existingPlayer = PlayerService.getPlayerById(id);
    if (existingPlayer === undefined) {
      return { success: false, errors: ['The selected player no longer exists.'] };
    }

    usePlayerStore().removePlayer(id);
    return { success: true, data: existingPlayer };
  }

  private static normalizePayload(payload: CreatePlayerDTO): CreatePlayerDTO {
    return {
      name: payload.name.trim(),
      position: payload.position.trim(),
      status: payload.status.trim(),
      teamId: payload.teamId,
      goals: payload.goals,
      assists: payload.assists,
    };
  }

  private static validatePlayer(payload: CreatePlayerDTO): string[] {
    const errors: string[] = [];

    if (payload.name === '') errors.push('Name is required.');
    if (payload.position === '') errors.push('Position is required.');
    if (!ACCEPTED_PLAYER_STATUSES.includes(payload.status)) {
      errors.push('Select a valid player status.');
    }
    if (payload.teamId !== null && TeamService.getTeamById(payload.teamId) === undefined) {
      errors.push('Select an existing team or leave the player as a free agent.');
    }
    if (!PlayerService.isNonNegativeInteger(payload.goals)) {
      errors.push('Goals must be a non-negative integer.');
    }
    if (!PlayerService.isNonNegativeInteger(payload.assists)) {
      errors.push('Assists must be a non-negative integer.');
    }

    return errors;
  }

  private static isNonNegativeInteger(value: number): boolean {
    return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
  }
}
