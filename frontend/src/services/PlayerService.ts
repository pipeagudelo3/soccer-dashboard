import type { CreatePlayerDTO } from '@/dtos/CreatePlayerDTO.js';
import type { UpdatePlayerDTO } from '@/dtos/UpdatePlayerDTO.js';
import type { PlayerInterface } from '@/interfaces/PlayerInterface.js';
import { usePlayerStore } from '@/stores/playerstore.js';
import { generateId } from '@/utils/generateId.js';

export class PlayerService {
  static getPlayers(): PlayerInterface[] {
    return usePlayerStore().players;
  }

  static getPlayerById(id: string): PlayerInterface | undefined {
    return usePlayerStore().players.find((player) => player.id === id);
  }

  static createPlayer(payload: CreatePlayerDTO): PlayerInterface {
    const timestamp = new Date().toISOString();

    const player: PlayerInterface = {
      ...payload,
      id: generateId('player'),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    usePlayerStore().addPlayer(player);

    return player;
  }

  static updatePlayer(id: string, payload: UpdatePlayerDTO): PlayerInterface | undefined {
    const existingPlayer = PlayerService.getPlayerById(id);

    if (existingPlayer === undefined) {
      return undefined;
    }

    const updatedPlayer: PlayerInterface = {
      ...existingPlayer,
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    usePlayerStore().updatePlayer(updatedPlayer);

    return updatedPlayer;
  }

  static deletePlayer(id: string): void {
    usePlayerStore().removePlayer(id);
  }
}
