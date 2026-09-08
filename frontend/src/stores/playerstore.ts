import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { PlayerInterface } from '@/interfaces/PlayerInterface.js';

export const usePlayerStore = defineStore('players', () => {
  const players = ref<PlayerInterface[]>([]);

  function setPlayers(newPlayers: PlayerInterface[]): void {
    players.value = [...newPlayers];
  }

  function addPlayer(player: PlayerInterface): void {
    players.value = [...players.value, player];
  }

  function updatePlayer(updatedPlayer: PlayerInterface): void {
    players.value = players.value.map((player) =>
      player.id === updatedPlayer.id ? updatedPlayer : player,
    );
  }

  function removePlayer(playerId: string): void {
    players.value = players.value.filter((player) => player.id !== playerId);
  }

  return { players, setPlayers, addPlayer, updatePlayer, removePlayer };
});
