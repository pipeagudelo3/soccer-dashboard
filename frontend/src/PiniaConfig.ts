import type { Pinia, StateTree } from 'pinia';
import { watch } from 'vue';

export const piniaStateKey = 'piniaState';
const persistedStateVersion = 2;
interface LoadedPiniaState {
  state: Record<string, StateTree>;
  canPersist: boolean;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isStateRecord(value: unknown): value is Record<string, StateTree> {
  return isRecord(value) && Object.values(value).every(isRecord);
}
// Canonical domain data and tokens are never restored from or written to browser storage.
function withoutBackendState(state: Record<string, StateTree>): Record<string, StateTree> {
  const persistedState = { ...state };
  delete persistedState.auth;
  delete persistedState.users;
  delete persistedState.teams;
  delete persistedState.players;
  delete persistedState.matchStats;
  return persistedState;
}
function loadState(): LoadedPiniaState {
  let stored: string | null;
  try {
    stored = localStorage.getItem(piniaStateKey);
  } catch {
    console.error('Unable to read the persisted Pinia state.');
    return { state: {}, canPersist: false };
  }
  if (stored === null) return { state: {}, canPersist: true };
  try {
    const parsed: unknown = JSON.parse(stored);
    if (isRecord(parsed) && parsed.version === persistedStateVersion && isStateRecord(parsed.state))
      return { state: withoutBackendState(parsed.state), canPersist: true };
    if (isStateRecord(parsed)) return { state: withoutBackendState(parsed), canPersist: true };
    console.error('The persisted Pinia state has an invalid format.');
  } catch {
    // JSON parse failures can include old credentials; never log the exception or raw snapshot.
    console.error('Unable to parse the persisted Pinia state.');
  }
  return { state: {}, canPersist: true };
}
function persistState(state: Record<string, StateTree>): void {
  try {
    localStorage.setItem(
      piniaStateKey,
      JSON.stringify({ version: persistedStateVersion, state: withoutBackendState(state) }),
    );
  } catch {
    console.error('Unable to persist the Pinia state.');
  }
}
export function configurePinia(pinia: Pinia): void {
  const loaded = loadState();
  pinia.state.value = loaded.state;
  if (!loaded.canPersist) return;
  persistState(pinia.state.value);
  watch(pinia.state, (state) => persistState(state), { deep: true });
}
