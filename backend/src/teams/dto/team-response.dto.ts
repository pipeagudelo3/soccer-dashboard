// Publica solamente el equipo aprobado, sin entidades anidadas ni arrays de relaciones.
export interface TeamResponseDTO {
  id: string;
  name: string;
  logoURL: string;
  country: string;
  stadium: string;
  foundedDate: string;
  createdAt: string;
  updatedAt: string;
}
