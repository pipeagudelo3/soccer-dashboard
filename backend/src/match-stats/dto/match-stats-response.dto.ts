// Contrato normalizado del frontend, sin nombres ni objetos de equipo embebidos.
export interface MatchStatsResponseDTO {
  id: string;
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  goalsHomeTeam: number;
  goalsAwayTeam: number;
  stadium: string;
  attendance: number;
  createdAt: string;
  updatedAt: string;
}
