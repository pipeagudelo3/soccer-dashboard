// Delimita el perfil público: ninguna respuesta puede incluir passwordHash.
export interface UserResponseDTO {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
  updatedAt: string;
}
