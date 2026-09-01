import type { TeamInterface } from '@/interfaces/TeamInterface.js';

export interface PlayerInterface {
  id: string;
  name: string;
  imageURL: string;
  position: string;
  dateOfBirth: string;
  nationality: string;
  height: number;
  weight: number;
  jerseyNumber: number;
  status: string;
  team: TeamInterface | null;
  matchesPlayed: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  foulsCommitted: number;
  foulsSuffered: number;
  passes: number;
  keyPasses: number;
  shots: number;
  shotsOnTarget: number;
  tackles: number;
  interceptions: number;
  dribbles: number;
  dribblesSuccess: number;
  duelsWon: number;
  duelsLost: number;
  createdAt: string;
  updatedAt: string;
}
