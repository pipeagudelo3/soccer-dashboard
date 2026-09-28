import type { LoginDTO } from '@/dtos/LoginDTO.js';
import type { AuthenticatedUserInterface } from '@/interfaces/AuthenticatedUserInterface.js';
import type { UserInterface } from '@/interfaces/UserInterface.js';
import type { ServiceResult } from '@/services/ServiceResult.js';
import { useAuthStore } from '@/stores/authstore.js';
import { useUserStore } from '@/stores/userstore.js';

export class AuthService {
  static login(credentials: LoginDTO): ServiceResult<AuthenticatedUserInterface> {
    const normalizedEmail = credentials.email.trim().toLowerCase();
    const invalidCredentialsError = ['Invalid email or password.'];

    if (normalizedEmail === '' || credentials.password.trim() === '') {
      return { success: false, errors: invalidCredentialsError };
    }

    const user = useUserStore().users.find(
      (storedUser) =>
        storedUser.email.toLowerCase() === normalizedEmail &&
        storedUser.password === credentials.password,
    );

    if (user === undefined) {
      return { success: false, errors: invalidCredentialsError };
    }

    const authenticatedUser = AuthService.createAuthenticatedUser(user);
    useAuthStore().setCurrentUser(authenticatedUser);

    return { success: true, data: authenticatedUser };
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

  static synchronizeCurrentUser(user: UserInterface): void {
    const authStore = useAuthStore();

    if (authStore.currentUser?.id === user.id) {
      authStore.setCurrentUser(AuthService.createAuthenticatedUser(user));
    }
  }

  static reconcileSession(): void {
    const currentUser = useAuthStore().currentUser;

    if (currentUser === null) {
      return;
    }

    const storedUser = useUserStore().users.find((user) => user.id === currentUser.id);

    if (storedUser === undefined) {
      AuthService.logout();
      return;
    }

    AuthService.synchronizeCurrentUser(storedUser);
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
