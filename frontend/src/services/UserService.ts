import type { CreateUserDTO } from '@/dtos/CreateUserDTO.js';
import type { UpdateUserDTO } from '@/dtos/UpdateUserDTO.js';
import type { UserInterface } from '@/interfaces/UserInterface.js';
import { ApiService } from '@/services/ApiService.js';
import { AuthService } from '@/services/AuthService.js';
import type { ServiceResult } from '@/services/ServiceResult.js';
import { useAuthStore } from '@/stores/authstore.js';

export interface DeleteUserData {
  deletedCurrentUser: boolean;
}

// Validate the public response at the boundary and discard all extra/sensitive fields.
function readUser(value: unknown): UserInterface | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id) ||
    !('name' in value) ||
    typeof value.name !== 'string' ||
    value.name.trim() === '' ||
    !('email' in value) ||
    typeof value.email !== 'string' ||
    value.email.trim() === '' ||
    !('role' in value) ||
    (value.role !== 'admin' && value.role !== 'user') ||
    !('createdAt' in value) ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !('updatedAt' in value) ||
    typeof value.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.updatedAt))
  )
    return null;
  return {
    id: value.id,
    name: value.name,
    email: value.email,
    role: value.role,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function permissionFailure(): ServiceResult<never> {
  return { success: false, statusCode: 403, errors: ['Administrator access is required.'] };
}

function invalidResponse(): ServiceResult<never> {
  return { success: false, errors: ['Unable to read the user data. Please reload and try again.'] };
}

export class UserService {
  static async getUsers(): Promise<ServiceResult<UserInterface[]>> {
    if (!AuthService.isAdmin()) return permissionFailure();
    const result = await ApiService.request<unknown>({ url: '/users' });
    if (!result.success) return UserService.handleFailure(result);
    if (!Array.isArray(result.data)) return invalidResponse();
    const users = result.data.map(readUser);
    if (users.some((user) => user === null)) return invalidResponse();
    return { success: true, data: users.filter((user): user is UserInterface => user !== null) };
  }

  static async getUserById(id: string): Promise<ServiceResult<UserInterface>> {
    return UserService.readRequest(id);
  }

  static async createUser(payload: CreateUserDTO): Promise<ServiceResult<UserInterface>> {
    if (!AuthService.isAdmin()) return permissionFailure();
    // Whitelist DTO fields; timestamps/IDs and arbitrary caller properties never become writable.
    const result = await ApiService.request<unknown>({
      url: '/users',
      method: 'POST',
      data: {
        name: payload.name,
        email: payload.email,
        password: payload.password,
        role: payload.role,
      },
    });
    return UserService.mapResponse(result);
  }

  static async updateUser(
    id: string,
    payload: UpdateUserDTO,
  ): Promise<ServiceResult<UserInterface>> {
    if (!AuthService.isAdmin()) return permissionFailure();
    const data: UpdateUserDTO = {};
    if (payload.name !== undefined) data.name = payload.name;
    if (payload.email !== undefined) data.email = payload.email;
    if (payload.password !== undefined) data.password = payload.password;
    if (payload.role !== undefined) data.role = payload.role;
    const store = useAuthStore();
    const token = store.accessToken;
    const result = await UserService.readRequest(id, data);
    // The write already succeeded. A failed /me check must not encourage repeating the PATCH.
    if (result.success && store.accessToken === token && store.currentUser?.id === id) {
      await AuthService.reconcileSession({ background: true });
    }
    return result;
  }

  static async deleteUser(id: string): Promise<ServiceResult<DeleteUserData>> {
    if (!AuthService.isAdmin()) return permissionFailure();
    const store = useAuthStore();
    const token = store.accessToken;
    const result = await ApiService.request<void>({
      url: `/users/${encodeURIComponent(id)}`,
      method: 'DELETE',
    });
    if (!result.success) return UserService.handleFailure(result);
    const deletedCurrentUser = store.currentUser?.id === id && store.accessToken === token;
    if (deletedCurrentUser) AuthService.logout();
    return { success: true, data: { deletedCurrentUser } };
  }

  private static async readRequest(
    id: string,
    data?: UpdateUserDTO,
  ): Promise<ServiceResult<UserInterface>> {
    if (!AuthService.isAdmin()) return permissionFailure();
    const result = await ApiService.request<unknown>({
      url: `/users/${encodeURIComponent(id)}`,
      method: data === undefined ? 'GET' : 'PATCH',
      data,
    });
    return UserService.mapResponse(result);
  }

  private static async mapResponse(
    result: ServiceResult<unknown>,
  ): Promise<ServiceResult<UserInterface>> {
    if (!result.success) return UserService.handleFailure(result);
    const user = readUser(result.data);
    return user === null ? invalidResponse() : { success: true, data: user };
  }

  private static async handleFailure<T>(result: ServiceResult<T>): Promise<ServiceResult<never>> {
    if (result.success) return invalidResponse();
    // A still-valid token can have lost its admin role; refresh navigation from /auth/me.
    if (result.statusCode === 403 && useAuthStore().accessToken !== null) {
      await AuthService.reconcileSession({ background: true });
    }
    return result;
  }
}
