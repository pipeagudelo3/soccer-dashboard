import type { TeamInterface } from '@/interfaces/TeamInterface.js';

export const medellinCondors: TeamInterface = {
  id: 'team-001',
  name: 'Medellin Condors',
  logoURL: 'https://placehold.co/128x128/0f766e/ffffff?text=MC',
  country: 'Colombia',
  stadium: 'Condor Arena',
  foundedDate: '1998-03-15',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

export const buenosAiresSur: TeamInterface = {
  id: 'team-002',
  name: 'Buenos Aires Sur',
  logoURL: 'https://placehold.co/128x128/2563eb/ffffff?text=BAS',
  country: 'Argentina',
  stadium: 'Estadio del Sur',
  foundedDate: '1987-07-20',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

export const rioStars: TeamInterface = {
  id: 'team-003',
  name: 'Rio Stars',
  logoURL: 'https://placehold.co/128x128/f59e0b/111827?text=RS',
  country: 'Brazil',
  stadium: 'Arena Estrela',
  foundedDate: '2001-01-12',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

export const montevideoCeleste: TeamInterface = {
  id: 'team-004',
  name: 'Montevideo Celeste',
  logoURL: 'https://placehold.co/128x128/38bdf8/082f49?text=MC',
  country: 'Uruguay',
  stadium: 'Parque Celeste',
  foundedDate: '1993-11-08',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

export const teamSeedData: TeamInterface[] = [
  medellinCondors,
  buenosAiresSur,
  rioStars,
  montevideoCeleste,
];
