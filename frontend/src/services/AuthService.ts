import type { LoginDTO } from '@/dtos/LoginDTO.js';
import type { AuthenticatedUserInterface } from '@/interfaces/AuthenticatedUserInterface.js';
import type { UserInterface } from '@/interfaces/UserInterface.js';
import { useAuthStore } from '@/stores/authstore.js';
import { useUserStore } from '@/stores/userstore.js';

export class AuthService {
  static login(credentials: LoginDTO): boolean {
    const normalizedEmail = credentials.email.trim().toLowerCase();

    const user = useUserStore().users.find(
      (storedUser) =>
        storedUser.email.toLowerCase() === normalizedEmail &&
        storedUser.password === credentials.password,
    );

    if (user === undefined) {
      return false;
    }

    useAuthStore().setCurrentUser(AuthService.createAuthenticatedUser(user));

    return true;
  }

  static logout(): void {
    useAuthStore().clearCurrentUser();
  }

  static getCurrentUser(): AuthenticatedUserInterface | null {
    return useAuthStore().currentUser;
  }

  static isAuthenticated(): boolean {
    return useAuthStore().isAuthenticated;
  }

  static isAdmin(): boolean {
    return useAuthStore().isAdmin;
  }

  private static createAuthenticatedUser(user: UserInterface): AuthenticatedUserInterface {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
