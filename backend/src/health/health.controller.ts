import { Controller, Get } from '@nestjs/common';

import { HealthService } from './health.service.js';
import type { HealthResponseDTO } from './health.service.js';

// Publica GET /api/health y delega el contenido de respuesta al servicio.
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getStatus(): HealthResponseDTO {
    return this.healthService.getStatus();
  }
}
