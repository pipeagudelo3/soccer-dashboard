import type { UserInterface } from '@/interfaces/UserInterface.js';

export type CreateUserDTO = Omit<UserInterface, 'id' | 'createdAt' | 'updatedAt'>;
