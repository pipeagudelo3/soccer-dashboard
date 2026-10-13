import type { CreateMatchStatsDTO } from '@/dtos/CreateMatchStatsDTO.js';
import type { UpdateMatchStatsDTO } from '@/dtos/UpdateMatchStatsDTO.js';
import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';
import {
  createRestResource,
  isCount,
  isId,
  isRecord,
  isText,
  isTimestamp,
} from '@/services/RestResource.js';

// Validate the public date representation before formatting it; request business rules belong to NestJS.
function isMatchDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function readMatch(value: unknown): MatchStatsInterface | null {
  if (
    !isRecord(value) ||
    !isId(value.id) ||
    !isMatchDate(value.date) ||
    !isId(value.homeTeamId) ||
    !isId(value.awayTeamId) ||
    value.homeTeamId === value.awayTeamId ||
    !isCount(value.goalsHomeTeam) ||
    !isCount(value.goalsAwayTeam) ||
    !isText(value.stadium) ||
    !isCount(value.attendance) ||
    !isTimestamp(value.createdAt) ||
    !isTimestamp(value.updatedAt)
  )
    return null;
  return {
    id: value.id,
    date: value.date,
    homeTeamId: value.homeTeamId,
    awayTeamId: value.awayTeamId,
    goalsHomeTeam: value.goalsHomeTeam,
    goalsAwayTeam: value.goalsAwayTeam,
    stadium: value.stadium,
    attendance: value.attendance,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}
const resource = createRestResource<MatchStatsInterface, CreateMatchStatsDTO, UpdateMatchStatsDTO>(
  '/match-stats',
  readMatch,
  ['date', 'homeTeamId', 'awayTeamId', 'goalsHomeTeam', 'goalsAwayTeam', 'stadium', 'attendance'],
);
export class MatchStatsService {
  static getMatchStats = resource.list;
  static getMatchStatsById = resource.get;
  static createMatchStats = resource.create;
  static updateMatchStats = resource.update;
  static deleteMatchStats = resource.remove;
}
