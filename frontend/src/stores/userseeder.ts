// Legacy fictional profiles retained for compatibility; backend administration never seeds from them.
import type { UserInterface } from '@/interfaces/UserInterface.js';

export const userSeedData: UserInterface[] = [
  {
    id: 'user-admin-001',
    name: 'Dashboard Administrator',
    email: 'admin@soccerdashboard.test',
    role: 'admin',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'user-regular-001',
    name: 'Soccer Analyst',
    email: 'analyst@soccerdashboard.test',
    role: 'user',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];
