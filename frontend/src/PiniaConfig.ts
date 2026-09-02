import type { Pinia, StateTree } from 'pinia';
import { watch } from 'vue';

export const piniaStateKey = 'piniaState';

function isPersistedState(value: unknown): value is Record<string, StateTree> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadPersistedState(): Record<string, StateTree> | null {
  const storedState = localStorage.getItem(piniaStateKey);

  if (storedState === null) {
    return null;
  }

  try {
    const parsedState: unknown = JSON.parse(storedState);

    if (!isPersistedState(parsedState)) {
      localStorage.removeItem(piniaStateKey);
      return null;
    }

    return parsedState;
  } catch {
    localStorage.removeItem(piniaStateKey);
    return null;
  }
}

export function configurePinia(pinia: Pinia): void {
  const persistedState = loadPersistedState();

  if (persistedState !== null) {
    pinia.state.value = persistedState;
  }

  watch(
    pinia.state,
    (state) => {
      localStorage.setItem(piniaStateKey, JSON.stringify(state));
    },
    { deep: true },
  );
}
