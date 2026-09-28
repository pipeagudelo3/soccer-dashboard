export interface PlayerInterface {
  id: string;
  name: string;
  position: string;
  status: string;
  teamId: string | null;
  goals: number;
  assists: number;
  createdAt: string;
  updatedAt: string;
}
