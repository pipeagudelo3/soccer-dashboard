import type { TeamInterface } from '#shared/interfaces/TeamInterface';
import { teams } from '~~/server/data/teams';

export class TeamCatalogService {
  public static getTeamById(id: string): TeamInterface | undefined {
    const team = teams.find((candidate) => candidate.id === id);
    return team ? { ...team } : undefined;
  }

  public static getTeams(): TeamInterface[] {
    return teams.map((team) => ({ ...team }));
  }
}
