import type { MatchStatsInterface } from '@/interfaces/MatchStatsInterface.js';

export type CreateMatchStatsDTO = Omit<MatchStatsInterface, 'id' | 'createdAt' | 'updatedAt'>;
