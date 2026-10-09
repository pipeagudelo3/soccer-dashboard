import { Injectable } from '@nestjs/common';

import type { HealthResponseDTO } from './dto/health-response.dto.js';

// Confirma que el proceso de la API responde; aún no comprueba una base de datos.
@Injectable()
export class HealthService {
  getStatus(): HealthResponseDTO {
    return { status: 'ok' };
  }
}
