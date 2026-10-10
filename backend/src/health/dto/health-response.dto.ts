import { ApiProperty } from '@nestjs/swagger';

// Define la respuesta pública sin revelar información de infraestructura.
export class HealthResponseDTO {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';
}
