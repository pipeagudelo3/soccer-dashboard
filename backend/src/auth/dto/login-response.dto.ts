import type { UserResponseDTO } from '../../users/dto/user-response.dto.js';

// Solo este endpoint entrega el access token; el perfil excluye credenciales.
export interface LoginResponseDTO {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserResponseDTO;
}
