import type { PlayerInterface } from '@/interfaces/PlayerInterface.js';

export type CreatePlayerDTO = Omit<PlayerInterface, 'id' | 'createdAt' | 'updatedAt'>;
