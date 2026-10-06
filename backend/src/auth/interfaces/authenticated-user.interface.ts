import type { Request } from 'express';

// El guard obtiene este perfil desde SQLite, nunca desde un rol enviado por el cliente.
export interface AuthenticatedUserInterface {
  id: string;
  role: 'admin' | 'user';
}

// El perfil existe únicamente después de superar JwtAuthGuard.
export interface AuthenticatedRequestInterface extends Request {
  user: AuthenticatedUserInterface;
}
