import { Injectable } from '@nestjs/common';

// Define la respuesta pública sin revelar información de infraestructura.
export interface HealthResponseDTO {
  status: 'ok';
}

// Confirma que el proceso de la API responde; aún no comprueba una base de datos.
@Injectable()
export class HealthService {
  getStatus(): HealthResponseDTO {
    return { status: 'ok' };
  }
}
