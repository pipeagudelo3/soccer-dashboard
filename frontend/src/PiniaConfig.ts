import type { Pinia, StateTree } from 'pinia';
import { watch } from 'vue';

import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';
import type { PlayerInterface } from '@/interfaces/PlayerInterface.js';
import { matchStatsSeedData } from '@/stores/matchstatsseeder.js';
import { playerSeedData } from '@/stores/playerseeder.js';
import { teamSeedData } from '@/stores/teamseeder.js';
import { userSeedData } from '@/stores/userseeder.js';

export const piniaStateKey = 'piniaState';
const legacyStateBackupKey = `${piniaStateKey}:v1:backup`;
const persistedStateVersion = 2;

interface PersistedPiniaState {
  version: 2;
  state: Record<string, StateTree>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStateTree(value: unknown): value is StateTree {
  return isRecord(value);
}

function isStateRecord(value: unknown): value is Record<string, StateTree> {
  return isRecord(value) && Object.values(value).every(isStateTree);
}

function isPersistedPiniaState(value: unknown): value is PersistedPiniaState {
  if (!isRecord(value)) {
    return false;
  }

  return value.version === persistedStateVersion && isStateRecord(value.state);
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readTeamId(record: Record<string, unknown>, key: string): string | null | undefined {
  const normalizedValue = record[`${key}Id`];

  if (typeof normalizedValue === 'string' || normalizedValue === null) {
    return normalizedValue;
  }

  const legacyValue = record[key];

  if (legacyValue === null) {
    return null;
  }

  if (!isRecord(legacyValue)) {
    return undefined;
  }

  return readString(legacyValue, 'id') ?? undefined;
}

function migratePlayer(value: unknown): PlayerInterface | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value, 'id');
  const name = readString(value, 'name');
  const position = readString(value, 'position');
  const status = readString(value, 'status');
  const teamId = readTeamId(value, 'team');
  const goals = readNumber(value, 'goals');
  const assists = readNumber(value, 'assists');
  const createdAt = readString(value, 'createdAt');
  const updatedAt = readString(value, 'updatedAt');

  if (
    id === null ||
    name === null ||
    position === null ||
    status === null ||
    teamId === undefined ||
    goals === null ||
    assists === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  return { id, name, position, status, teamId, goals, assists, createdAt, updatedAt };
}

function migrateMatchStats(value: unknown): MatchStatsInterface | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value, 'id');
  const date = readString(value, 'date');
  const homeTeamId = readTeamId(value, 'homeTeam');
  const awayTeamId = readTeamId(value, 'awayTeam');
  const goalsHomeTeam = readNumber(value, 'goalsHomeTeam');
  const goalsAwayTeam = readNumber(value, 'goalsAwayTeam');
  const stadium = readString(value, 'stadium');
  const attendance = readNumber(value, 'attendance');
  const createdAt = readString(value, 'createdAt');
  const updatedAt = readString(value, 'updatedAt');

  if (
    id === null ||
    date === null ||
    homeTeamId === null ||
    homeTeamId === undefined ||
    awayTeamId === null ||
    awayTeamId === undefined ||
    goalsHomeTeam === null ||
    goalsAwayTeam === null ||
    stadium === null ||
    attendance === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  return {
    id,
    date,
    homeTeamId,
    awayTeamId,
    goalsHomeTeam,
    goalsAwayTeam,
    stadium,
    attendance,
    createdAt,
    updatedAt,
  };
}

function migrateLegacyState(
  legacyState: Record<string, StateTree>,
): Record<string, StateTree> | null {
  const playersState = legacyState.players;
  const matchStatsState = legacyState.matchStats;

  if (!isRecord(playersState) || !Array.isArray(playersState.players)) {
    return null;
  }

  if (!isRecord(matchStatsState) || !Array.isArray(matchStatsState.matchStats)) {
    return null;
  }

  const players = playersState.players.map(migratePlayer);
  const matchStats = matchStatsState.matchStats.map(migrateMatchStats);

  if (players.some((player) => player === null) || matchStats.some((match) => match === null)) {
    return null;
  }

  const migratedPlayers = players.filter((player): player is PlayerInterface => player !== null);
  const migratedMatchStats = matchStats.filter(
    (match): match is MatchStatsInterface => match !== null,
  );

  return {
    ...legacyState,
    players: { ...playersState, players: migratedPlayers },
    matchStats: { ...matchStatsState, matchStats: migratedMatchStats },
  };
}

function createInitialState(): Record<string, StateTree> {
  return {
    auth: { currentUser: null },
    users: { users: userSeedData.map((user) => ({ ...user })) },
    teams: { teams: teamSeedData.map((team) => ({ ...team })) },
    players: { players: playerSeedData.map((player) => ({ ...player })) },
    matchStats: { matchStats: matchStatsSeedData.map((match) => ({ ...match })) },
  };
}

function backUpLegacyState(storedState: string): void {
  if (localStorage.getItem(legacyStateBackupKey) === null) {
    localStorage.setItem(legacyStateBackupKey, storedState);
  }
}

function loadState(): Record<string, StateTree> {
  const storedState = localStorage.getItem(piniaStateKey);

  if (storedState === null) {
    return createInitialState();
  }

  try {
    const parsedState: unknown = JSON.parse(storedState);

    if (isPersistedPiniaState(parsedState)) {
      return parsedState.state;
    }

    backUpLegacyState(storedState);

    if (isStateRecord(parsedState)) {
      return migrateLegacyState(parsedState) ?? createInitialState();
    }
  } catch {
    backUpLegacyState(storedState);
  }

  return createInitialState();
}

function persistState(state: Record<string, StateTree>): void {
  const persistedState: PersistedPiniaState = {
    version: persistedStateVersion,
    state,
  };

  localStorage.setItem(piniaStateKey, JSON.stringify(persistedState));
}

export function configurePinia(pinia: Pinia): void {
  pinia.state.value = loadState();
  persistState(pinia.state.value);

  watch(pinia.state, (state) => persistState(state), { deep: true });
}
