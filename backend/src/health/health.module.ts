import { Module } from '@nestjs/common';

import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

// Agrupa las dependencias de Health según el patrón de módulos del ejemplo.
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
