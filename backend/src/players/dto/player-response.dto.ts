import type { Player } from '../entities/player.entity.js';

// Mantiene exactamente las nueve propiedades de PlayerInterface del frontend.
export interface PlayerResponseDTO {
  id: string;
  name: string;
  position: string;
  status: Player['status'];
  teamId: string | null;
  goals: number;
  assists: number;
  createdAt: string;
  updatedAt: string;
}
