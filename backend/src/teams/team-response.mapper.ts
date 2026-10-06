import type { TeamResponseDTO } from './dto/team-response.dto.js';
import type { Team } from './entities/team.entity.js';

// La lista explícita impide que relaciones ORM cargadas accidentalmente salgan por HTTP.
export function mapTeamResponse(team: Team): TeamResponseDTO {
  return {
    id: team.id,
    name: team.name,
    logoURL: team.logoURL,
    country: team.country,
    stadium: team.stadium,
    foundedDate: team.foundedDate,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  };
}
