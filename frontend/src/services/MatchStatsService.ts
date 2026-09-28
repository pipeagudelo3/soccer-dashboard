import type { CreateMatchStatsDTO } from '@/dtos/CreateMatchStatsDTO.js';
import type { UpdateMatchStatsDTO } from '@/dtos/UpdateMatchStatsDTO.js';
import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';
import { AuthService } from '@/services/AuthService.js';
import type { ServiceResult } from '@/services/ServiceResult.js';
import { TeamService } from '@/services/TeamService.js';
import { useMatchStatsStore } from '@/stores/matchstatsstore.js';
import { generateId } from '@/utils/generateId.js';

export class MatchStatsService {
  static getMatchStats(): MatchStatsInterface[] {
    return useMatchStatsStore().matchStats;
  }

  static getMatchStatsById(id: string): MatchStatsInterface | undefined {
    return useMatchStatsStore().matchStats.find((matchStats) => matchStats.id === id);
  }

  static createMatchStats(payload: CreateMatchStatsDTO): ServiceResult<MatchStatsInterface> {
    if (!AuthService.isAdmin()) {
      return {
        success: false,
        errors: ['Administrator access is required.'],
      };
    }

    const validatedPayload = MatchStatsService.validateAndNormalizePayload(payload);

    if (validatedPayload.errors.length > 0 || validatedPayload.payload === undefined) {
      return { success: false, errors: validatedPayload.errors };
    }

    const timestamp = new Date().toISOString();
    const matchStats: MatchStatsInterface = {
      ...validatedPayload.payload,
      id: generateId('match-stats'),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    useMatchStatsStore().addMatchStats(matchStats);

    return { success: true, data: matchStats };
  }

  static updateMatchStats(
    id: string,
    payload: UpdateMatchStatsDTO,
  ): ServiceResult<MatchStatsInterface> {
    if (!AuthService.isAdmin()) {
      return {
        success: false,
        errors: ['Administrator access is required.'],
      };
    }

    const existingMatchStats = MatchStatsService.getMatchStatsById(id);

    if (existingMatchStats === undefined) {
      return { success: false, errors: ['The selected match statistics no longer exist.'] };
    }

    const candidatePayload: CreateMatchStatsDTO = {
      date: payload.date ?? existingMatchStats.date,
      homeTeamId: payload.homeTeamId ?? existingMatchStats.homeTeamId,
      awayTeamId: payload.awayTeamId ?? existingMatchStats.awayTeamId,
      goalsHomeTeam: payload.goalsHomeTeam ?? existingMatchStats.goalsHomeTeam,
      goalsAwayTeam: payload.goalsAwayTeam ?? existingMatchStats.goalsAwayTeam,
      stadium: payload.stadium ?? existingMatchStats.stadium,
      attendance: payload.attendance ?? existingMatchStats.attendance,
    };
    const validatedPayload = MatchStatsService.validateAndNormalizePayload(candidatePayload, id);

    if (validatedPayload.errors.length > 0 || validatedPayload.payload === undefined) {
      return { success: false, errors: validatedPayload.errors };
    }

    const updatedMatchStats: MatchStatsInterface = {
      ...existingMatchStats,
      ...validatedPayload.payload,
      updatedAt: new Date().toISOString(),
    };

    useMatchStatsStore().updateMatchStats(updatedMatchStats);

    return { success: true, data: updatedMatchStats };
  }

  static deleteMatchStats(id: string): ServiceResult<MatchStatsInterface> {
    if (!AuthService.isAdmin()) {
      return {
        success: false,
        errors: ['Administrator access is required.'],
      };
    }

    const existingMatchStats = MatchStatsService.getMatchStatsById(id);

    if (existingMatchStats === undefined) {
      return { success: false, errors: ['The selected match statistics no longer exist.'] };
    }

    useMatchStatsStore().removeMatchStats(id);

    return { success: true, data: existingMatchStats };
  }

  private static validateAndNormalizePayload(
    payload: CreateMatchStatsDTO,
    excludedMatchStatsId?: string,
  ): {
    payload?: CreateMatchStatsDTO;
    errors: string[];
  } {
    const errors: string[] = [];
    const date = payload.date.trim();
    const stadium = payload.stadium.trim();
    const homeTeam = TeamService.getTeamById(payload.homeTeamId);
    const awayTeam = TeamService.getTeamById(payload.awayTeamId);

    if (!MatchStatsService.isValidIsoDate(date)) {
      errors.push('Enter a valid match date.');
    } else if (date > MatchStatsService.getCurrentIsoDate()) {
      errors.push('Match date cannot be in the future.');
    }

    if (homeTeam === undefined) {
      errors.push('Select an existing home team.');
    }

    if (awayTeam === undefined) {
      errors.push('Select an existing away team.');
    }

    if (homeTeam !== undefined && awayTeam !== undefined && homeTeam.id === awayTeam.id) {
      errors.push('Home and away teams must be different.');
    }

    if (!MatchStatsService.isNonNegativeInteger(payload.goalsHomeTeam)) {
      errors.push('Home team goals must be a non-negative integer.');
    }

    if (!MatchStatsService.isNonNegativeInteger(payload.goalsAwayTeam)) {
      errors.push('Away team goals must be a non-negative integer.');
    }

    if (stadium === '') {
      errors.push('Stadium is required.');
    }

    if (!MatchStatsService.isNonNegativeInteger(payload.attendance)) {
      errors.push('Attendance must be a non-negative integer.');
    }

    if (
      MatchStatsService.matchExists(
        date,
        payload.homeTeamId,
        payload.awayTeamId,
        excludedMatchStatsId,
      )
    ) {
      errors.push('Match statistics already exist for this date and pair of teams.');
    }

    if (errors.length > 0 || homeTeam === undefined || awayTeam === undefined) {
      return { errors };
    }

    return {
      errors: [],
      payload: {
        date,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        goalsHomeTeam: payload.goalsHomeTeam,
        goalsAwayTeam: payload.goalsAwayTeam,
        stadium,
        attendance: payload.attendance,
      },
    };
  }

  private static isNonNegativeInteger(value: number): boolean {
    return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
  }

  private static matchExists(
    date: string,
    homeTeamId: string,
    awayTeamId: string,
    excludedMatchStatsId?: string,
  ): boolean {
    return useMatchStatsStore().matchStats.some(
      (matchStats) =>
        matchStats.id !== excludedMatchStatsId &&
        matchStats.date === date &&
        matchStats.homeTeamId === homeTeamId &&
        matchStats.awayTeamId === awayTeamId,
    );
  }

  private static getCurrentIsoDate(): string {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private static isValidIsoDate(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (match === null) {
      return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }
}
