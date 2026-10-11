import type { CreateTeamDTO } from '@/dtos/CreateTeamDTO.js';
import type { UpdateTeamDTO } from '@/dtos/UpdateTeamDTO.js';
import type { TeamInterface } from '@/interfaces/TeamInterface.js';
import {
  createRestResource,
  isId,
  isRecord,
  isText,
  isTimestamp,
} from '@/services/RestResource.js';

function readTeam(value: unknown): TeamInterface | null {
  if (
    !isRecord(value) ||
    !isId(value.id) ||
    !isText(value.name) ||
    !isText(value.logoURL) ||
    !isText(value.country) ||
    !isText(value.stadium) ||
    !isText(value.foundedDate) ||
    !isTimestamp(value.createdAt) ||
    !isTimestamp(value.updatedAt)
  )
    return null;
  return {
    id: value.id,
    name: value.name,
    logoURL: value.logoURL,
    country: value.country,
    stadium: value.stadium,
    foundedDate: value.foundedDate,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}
const resource = createRestResource<TeamInterface, CreateTeamDTO, UpdateTeamDTO>(
  '/teams',
  readTeam,
  ['name', 'logoURL', 'country', 'stadium', 'foundedDate'],
);
export class TeamService {
  static getTeams = resource.list;
  static getTeamById = resource.get;
  static createTeam = resource.create;
  static updateTeam = resource.update;
  static deleteTeam = resource.remove;
}
