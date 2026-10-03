import type { MatchStats } from '../match-stats/entities/match-stats.entity.js';
import type { Player } from '../players/entities/player.entity.js';
import type { Team } from '../teams/entities/team.entity.js';
import type { User } from '../users/entities/user.entity.js';

// Estos tipos describen fixtures, no entidades ni tablas nuevas del dominio.
export type SeedTeamDTO = Pick<
  Team,
  'id' | 'name' | 'logoURL' | 'country' | 'stadium' | 'foundedDate'
>;
export type SeedPlayerDTO = Pick<
  Player,
  'id' | 'name' | 'position' | 'status' | 'teamId' | 'goals' | 'assists'
>;
export type SeedMatchStatsDTO = Pick<
  MatchStats,
  | 'id'
  | 'date'
  | 'homeTeamId'
  | 'awayTeamId'
  | 'goalsHomeTeam'
  | 'goalsAwayTeam'
  | 'stadium'
  | 'attendance'
>;
export type SeedUserDTO = Pick<User, 'id' | 'name' | 'email' | 'role'> & { password: string };

// UUIDs constantes permiten reconocer registros aunque el usuario edite sus campos.
const teamIds = {
  andes: '20000000-0000-4000-8000-000000000001',
  coast: '20000000-0000-4000-8000-000000000002',
  sierra: '20000000-0000-4000-8000-000000000003',
  valley: '20000000-0000-4000-8000-000000000004',
};

// Credenciales ficticias documentadas para evaluación académica, nunca de personas reales.
// Administrador: admin@soccer.example / AdminDemo123
// Usuario regular: user@soccer.example / UserDemo123
// El servicio convierte estos valores en hashes antes de guardar y no los imprime.
export const seedUsers: readonly SeedUserDTO[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Demo Administrator',
    email: 'admin@soccer.example',
    role: 'admin',
    password: 'AdminDemo123',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Demo User',
    email: 'user@soccer.example',
    role: 'user',
    password: 'UserDemo123',
  },
];

// Equipos completamente ficticios; los campos mantienen el modelo aprobado.
export const seedTeams: readonly SeedTeamDTO[] = [
  {
    id: teamIds.andes,
    name: 'Andes FC',
    logoURL: 'https://example.com/andes.png',
    country: 'Colombia',
    stadium: 'Andes Stadium',
    foundedDate: '1980-01-15',
  },
  {
    id: teamIds.coast,
    name: 'Costa Azul FC',
    logoURL: 'https://example.com/coast.png',
    country: 'Colombia',
    stadium: 'Coast Stadium',
    foundedDate: '1990-05-20',
  },
  {
    id: teamIds.sierra,
    name: 'Sierra United',
    logoURL: 'https://example.com/sierra.png',
    country: 'Argentina',
    stadium: 'Sierra Stadium',
    foundedDate: '1975-03-10',
  },
  {
    id: teamIds.valley,
    name: 'Valle Athletic',
    logoURL: 'https://example.com/valley.png',
    country: 'Spain',
    stadium: 'Valley Stadium',
    foundedDate: '1985-09-12',
  },
];

// Incluye distintos estados, valores cero y un jugador sin equipo para probar la UI.
export const seedPlayers: readonly SeedPlayerDTO[] = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    name: 'Alex Demo',
    position: 'Forward',
    status: 'active',
    teamId: teamIds.andes,
    goals: 5,
    assists: 2,
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    name: 'Sam Demo',
    position: 'Midfielder',
    status: 'injured',
    teamId: teamIds.andes,
    goals: 1,
    assists: 4,
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    name: 'Jordan Demo',
    position: 'Forward',
    status: 'active',
    teamId: teamIds.coast,
    goals: 4,
    assists: 1,
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    name: 'Taylor Demo',
    position: 'Defender',
    status: 'suspended',
    teamId: teamIds.coast,
    goals: 0,
    assists: 1,
  },
  {
    id: '30000000-0000-4000-8000-000000000005',
    name: 'Casey Demo',
    position: 'Forward',
    status: 'active',
    teamId: teamIds.sierra,
    goals: 2,
    assists: 0,
  },
  {
    id: '30000000-0000-4000-8000-000000000006',
    name: 'Riley Demo',
    position: 'Goalkeeper',
    status: 'active',
    teamId: teamIds.sierra,
    goals: 0,
    assists: 0,
  },
  {
    id: '30000000-0000-4000-8000-000000000007',
    name: 'Morgan Demo',
    position: 'Forward',
    status: 'active',
    teamId: teamIds.valley,
    goals: 1,
    assists: 2,
  },
  {
    id: '30000000-0000-4000-8000-000000000008',
    name: 'Jamie Demo',
    position: 'Midfielder',
    status: 'free-agent',
    teamId: null,
    goals: 0,
    assists: 0,
  },
];

// Fechas históricas estables, referencias válidas y parejas local/visitante diferentes.
export const seedMatchStats: readonly SeedMatchStatsDTO[] = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    date: '2025-08-01',
    homeTeamId: teamIds.andes,
    awayTeamId: teamIds.coast,
    goalsHomeTeam: 2,
    goalsAwayTeam: 1,
    stadium: 'Andes Stadium',
    attendance: 12000,
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    date: '2025-08-02',
    homeTeamId: teamIds.sierra,
    awayTeamId: teamIds.valley,
    goalsHomeTeam: 0,
    goalsAwayTeam: 0,
    stadium: 'Sierra Stadium',
    attendance: 8000,
  },
  {
    id: '40000000-0000-4000-8000-000000000003',
    date: '2025-08-08',
    homeTeamId: teamIds.coast,
    awayTeamId: teamIds.sierra,
    goalsHomeTeam: 3,
    goalsAwayTeam: 2,
    stadium: 'Coast Stadium',
    attendance: 15000,
  },
  {
    id: '40000000-0000-4000-8000-000000000004',
    date: '2025-08-09',
    homeTeamId: teamIds.valley,
    awayTeamId: teamIds.andes,
    goalsHomeTeam: 1,
    goalsAwayTeam: 2,
    stadium: 'Valley Stadium',
    attendance: 10000,
  },
];
