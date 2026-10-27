import { $fetch } from '#imports';
import type { TeamInterface } from '#shared/interfaces/TeamInterface';

export class TeamService {
  public static getTeamById(id: string): Promise<TeamInterface> {
    return $fetch<TeamInterface>(`/api/teams/${encodeURIComponent(id)}`);
  }

  public static getTeams(): Promise<TeamInterface[]> {
    return $fetch<TeamInterface[]>('/api/teams');
  }
}
