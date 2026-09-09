import type { CreateUserDTO } from '@/dtos/CreateUserDTO.js';
import type { UpdateUserDTO } from '@/dtos/UpdateUserDTO.js';
import type { UserInterface } from '@/interfaces/UserInterface.js';
import { AuthService } from '@/services/AuthService.js';
import { useUserStore } from '@/stores/userstore.js';
import { generateId } from '@/utils/generateId.js';

const ACCEPTED_USER_ROLES = ['admin', 'user'];
const MINIMUM_PASSWORD_LENGTH = 8;

export type UserServiceResult = {
  success: boolean;
  errors: string[];
  user?: UserInterface;
  deletedCurrentUser?: boolean;
};

export class UserService {
  static getUsers(): UserInterface[] {
    return useUserStore().users;
  }

  static getUserById(id: string): UserInterface | undefined {
    return useUserStore().users.find((user) => user.id === id);
  }

  static createUser(payload: CreateUserDTO): UserServiceResult {
    if (!AuthService.isAdmin()) {
      return {
        success: false,
        errors: ['Administrator access is required.'],
      };
    }

    const normalizedPayload = UserService.normalizePayload(payload);
    const errors = UserService.validateUser(normalizedPayload);

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const timestamp = new Date().toISOString();
    const user: UserInterface = {
      ...normalizedPayload,
      id: generateId('user'),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    useUserStore().addUser(user);

    return { success: true, errors: [], user };
  }

  static updateUser(id: string, payload: UpdateUserDTO): UserServiceResult {
    if (!AuthService.isAdmin()) {
      return {
        success: false,
        errors: ['Administrator access is required.'],
      };
    }

    const existingUser = UserService.getUserById(id);

    if (existingUser === undefined) {
      return { success: false, errors: ['The selected user no longer exists.'] };
    }

    const normalizedPayload = UserService.normalizePayload({
      name: payload.name ?? existingUser.name,
      email: payload.email ?? existingUser.email,
      password: payload.password ?? existingUser.password,
      role: payload.role ?? existingUser.role,
    });
    const errors = UserService.validateUser(normalizedPayload, id);

    if (
      existingUser.role === 'admin' &&
      normalizedPayload.role !== 'admin' &&
      UserService.countAdministrators() === 1
    ) {
      errors.push('The last administrator cannot be assigned a non-administrator role.');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const updatedUser: UserInterface = {
      ...existingUser,
      ...normalizedPayload,
      updatedAt: new Date().toISOString(),
    };

    useUserStore().updateUser(updatedUser);
    AuthService.synchronizeCurrentUser(updatedUser);

    return { success: true, errors: [], user: updatedUser };
  }

  static deleteUser(id: string): UserServiceResult {
    if (!AuthService.isAdmin()) {
      return {
        success: false,
        errors: ['Administrator access is required.'],
      };
    }

    const existingUser = UserService.getUserById(id);

    if (existingUser === undefined) {
      return { success: false, errors: ['The selected user no longer exists.'] };
    }

    if (existingUser.role === 'admin' && UserService.countAdministrators() === 1) {
      return { success: false, errors: ['The last administrator cannot be deleted.'] };
    }

    const deletedCurrentUser = AuthService.getCurrentUser()?.id === existingUser.id;

    useUserStore().removeUser(id);

    if (deletedCurrentUser) {
      AuthService.logout();
    }

    return { success: true, errors: [], deletedCurrentUser };
  }

  private static normalizePayload(payload: CreateUserDTO): CreateUserDTO {
    return {
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      role: payload.role.trim().toLowerCase(),
    };
  }

  private static validateUser(payload: CreateUserDTO, excludedUserId?: string): string[] {
    const errors: string[] = [];

    if (payload.name === '') {
      errors.push('Name is required.');
    }

    if (payload.email === '') {
      errors.push('Email is required.');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      errors.push('Enter a valid email address.');
    } else if (UserService.emailExists(payload.email, excludedUserId)) {
      errors.push('A user with this email already exists.');
    }

    if (payload.password.length < MINIMUM_PASSWORD_LENGTH) {
      errors.push(`Password must contain at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
    }

    if (!/[a-z]/.test(payload.password)) {
      errors.push('Password must contain at least one lowercase letter.');
    }

    if (!/[A-Z]/.test(payload.password)) {
      errors.push('Password must contain at least one uppercase letter.');
    }

    if (!/[0-9]/.test(payload.password)) {
      errors.push('Password must contain at least one number.');
    }

    if (!ACCEPTED_USER_ROLES.some((role) => role === payload.role)) {
      errors.push('Role must be either admin or user.');
    }

    return errors;
  }

  private static emailExists(email: string, excludedUserId?: string): boolean {
    return useUserStore().users.some(
      (user) => user.id !== excludedUserId && user.email.toLowerCase() === email.toLowerCase(),
    );
  }

  private static countAdministrators(): number {
    return useUserStore().users.filter((user) => user.role === 'admin').length;
  }
}
