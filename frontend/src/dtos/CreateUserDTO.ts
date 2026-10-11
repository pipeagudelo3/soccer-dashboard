import type { UserInterface } from '@/interfaces/UserInterface.js';

export type CreateUserDTO = Pick<UserInterface, 'name' | 'email' | 'role'> & {
  password: string;
};
