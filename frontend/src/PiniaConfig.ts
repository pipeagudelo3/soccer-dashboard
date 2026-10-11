import type { Pinia, StateTree } from 'pinia';
import { watch } from 'vue';

import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';
import { matchStatsSeedData } from '@/stores/matchstatsseeder.js';

export const piniaStateKey = 'piniaState';
const legacyStateBackupKey = `${piniaStateKey}:v1:backup`;
const persistedStateVersion = 2;

interface PersistedPiniaState {
  version: 2;
  state: Record<string, StateTree>;
}

interface LoadedPiniaState {
  state: Record<string, StateTree>;
  canPersist: boolean;
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
  const matchStatsState = legacyState.matchStats;

  if (!isRecord(matchStatsState) || !Array.isArray(matchStatsState.matchStats)) {
    return null;
  }

  const matchStats = matchStatsState.matchStats.map(migrateMatchStats);

  if (matchStats.some((match) => match === null)) {
    return null;
  }

  const migratedMatchStats = matchStats.filter(
    (match): match is MatchStatsInterface => match !== null,
  );

  return {
    ...legacyState,
    matchStats: { ...matchStatsState, matchStats: migratedMatchStats },
  };
}

function createInitialState(): Record<string, StateTree> {
  return {
    auth: { currentUser: null },
    matchStats: { matchStats: matchStatsSeedData.map((match) => ({ ...match })) },
  };
}

// Legacy parsing errors can quote old credentials; only stable diagnostics are logged.
function backUpLegacyState(storedState: string): boolean {
  try {
    if (localStorage.getItem(legacyStateBackupKey) === null) {
      localStorage.setItem(legacyStateBackupKey, storedState);
    }

    return true;
  } catch {
    console.error('Unable to back up the legacy Pinia state in LocalStorage.');
    return false;
  }
}

function loadState(): LoadedPiniaState {
  let storedState: string | null;

  try {
    storedState = localStorage.getItem(piniaStateKey);
  } catch {
    console.error('Unable to read the persisted Pinia state from LocalStorage.');
    return { state: createInitialState(), canPersist: false };
  }

  if (storedState === null) {
    return { state: createInitialState(), canPersist: true };
  }

  try {
    const parsedState: unknown = JSON.parse(storedState);

    if (isPersistedPiniaState(parsedState)) {
      return { state: parsedState.state, canPersist: true };
    }

    if (!backUpLegacyState(storedState)) {
      return { state: createInitialState(), canPersist: false };
    }

    if (isStateRecord(parsedState)) {
      const migratedState = migrateLegacyState(parsedState);

      if (migratedState === null) {
        console.error('Unable to migrate the legacy Pinia state. Initial data will be used.');
      }

      return {
        state: migratedState ?? createInitialState(),
        canPersist: true,
      };
    }

    console.error('The persisted Pinia state has an invalid format. Initial data will be used.');
  } catch {
    console.error('Unable to parse or migrate the persisted Pinia state.');

    if (!backUpLegacyState(storedState)) {
      return { state: createInitialState(), canPersist: false };
    }
  }

  return { state: createInitialState(), canPersist: true };
}

// Backend-owned auth, users, teams and players are never hydrated or persisted as a local database.
function withoutBackendState(state: Record<string, StateTree>): Record<string, StateTree> {
  const persistedState = { ...state };
  delete persistedState.auth;
  delete persistedState.users;
  delete persistedState.teams;
  delete persistedState.players;
  return persistedState;
}

function persistState(state: Record<string, StateTree>): void {
  const persistedState: PersistedPiniaState = {
    version: persistedStateVersion,
    state: withoutBackendState(state),
  };

  try {
    localStorage.setItem(piniaStateKey, JSON.stringify(persistedState));
  } catch {
    console.error('Unable to persist the Pinia state in LocalStorage.');
  }
}

export function configurePinia(pinia: Pinia): void {
  const loadedState = loadState();
  // Old local identities cannot grant backend access after a reload.
  pinia.state.value = withoutBackendState(loadedState.state);

  if (!loadedState.canPersist) {
    return;
  }

  persistState(pinia.state.value);

  watch(pinia.state, (state) => persistState(state), { deep: true });
}
