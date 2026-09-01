import type { TeamInterface } from '@/interfaces/TeamInterface.js';

export interface MatchStatsInterface {
  id: string;
  date: string;
  homeTeam: TeamInterface;
  awayTeam: TeamInterface;
  goalsHomeTeam: number;
  goalsAwayTeam: number;
  stadium: string;
  attendance: number;
  createdAt: string;
  updatedAt: string;
}
