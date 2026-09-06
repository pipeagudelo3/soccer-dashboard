import type { UserInterface } from '@/interfaces/UserInterface.js';

export const userSeedData: UserInterface[] = [
  {
    id: 'user-admin-001',
    name: 'Dashboard Administrator',
    email: 'admin@soccerdashboard.test',
    password: 'Admin123!',
    role: 'admin',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'user-regular-001',
    name: 'Soccer Analyst',
    email: 'analyst@soccerdashboard.test',
    password: 'User123!',
    role: 'user',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];
