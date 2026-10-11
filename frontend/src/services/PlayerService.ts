import type { CreatePlayerDTO } from '@/dtos/CreatePlayerDTO.js';
import type { UpdatePlayerDTO } from '@/dtos/UpdatePlayerDTO.js';
import type { PlayerInterface } from '@/interfaces/PlayerInterface.js';
import {
  createRestResource,
  isCount,
  isId,
  isRecord,
  isText,
  isTimestamp,
} from '@/services/RestResource.js';

function readPlayer(value: unknown): PlayerInterface | null {
  if (
    !isRecord(value) ||
    !isId(value.id) ||
    !isText(value.name) ||
    !isText(value.position) ||
    !isText(value.status) ||
    !['active', 'injured', 'suspended', 'free-agent'].includes(value.status) ||
    (value.teamId !== null && !isId(value.teamId)) ||
    !isCount(value.goals) ||
    !isCount(value.assists) ||
    !isTimestamp(value.createdAt) ||
    !isTimestamp(value.updatedAt)
  )
    return null;
  return {
    id: value.id,
    name: value.name,
    position: value.position,
    status: value.status,
    teamId: value.teamId,
    goals: value.goals,
    assists: value.assists,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}
const resource = createRestResource<PlayerInterface, CreatePlayerDTO, UpdatePlayerDTO>(
  '/players',
  readPlayer,
  ['name', 'position', 'status', 'teamId', 'goals', 'assists'],
);
export class PlayerService {
  static getPlayers = resource.list;
  static getPlayerById = resource.get;
  static createPlayer = resource.create;
  static updatePlayer = resource.update;
  static deletePlayer = resource.remove;
}
