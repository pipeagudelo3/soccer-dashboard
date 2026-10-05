import type { PlayerResponseDTO } from './dto/player-response.dto.js';
import type { Player } from './entities/player.entity.js';

// Una lista explícita excluye relaciones ORM aunque hayan sido cargadas por el repositorio.
export function mapPlayerResponse(player: Player): PlayerResponseDTO {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    status: player.status,
    teamId: player.teamId,
    goals: player.goals,
    assists: player.assists,
    createdAt: player.createdAt.toISOString(),
    updatedAt: player.updatedAt.toISOString(),
  };
}
