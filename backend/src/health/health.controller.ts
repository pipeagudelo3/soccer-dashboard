import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { HealthResponseDTO } from './dto/health-response.dto.js';
import { HealthService } from './health.service.js';

// Publica GET /api/health y delega el contenido de respuesta al servicio.
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check that the API is running (public)' })
  @ApiOkResponse({ type: HealthResponseDTO })
  getStatus(): HealthResponseDTO {
    return this.healthService.getStatus();
  }
}
