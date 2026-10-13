import { ApiProperty } from '@nestjs/swagger';

// Propiedades que toda respuesta de dominio hereda de BaseEntity.
export class BaseResponseDTO {
  @ApiProperty({ format: 'uuid', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id!: string;

  @ApiProperty({ format: 'date-time', example: '2026-10-08T15:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', example: '2026-10-08T15:30:00.000Z' })
  updatedAt!: string;
}
