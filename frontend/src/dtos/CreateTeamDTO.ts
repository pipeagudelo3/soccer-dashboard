import type { TeamInterface } from '@/interfaces/TeamInterface.js';

export type CreateTeamDTO = Omit<TeamInterface, 'id' | 'createdAt' | 'updatedAt'>;
