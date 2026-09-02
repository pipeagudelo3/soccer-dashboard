import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { PlayerInterface } from '@/interfaces/PlayerInterface.js';

export const usePlayerStore = defineStore('players', () => {
  const players = ref<PlayerInterface[]>([]);

  function setPlayers(newPlayers: PlayerInterface[]): void {
    players.value = [...newPlayers];
  }

  return { players, setPlayers };
});
