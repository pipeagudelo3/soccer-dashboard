import { ApiProperty } from '@nestjs/swagger';

// Mantiene el contrato de errores de #39 sin datos internos ni valores sensibles.
export class ApiErrorResponseDTO {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ type: [String], example: ['name should not be empty'] })
  message!: string[];

  @ApiProperty({ example: '/api/teams' })
  path!: string;

  @ApiProperty({ format: 'date-time', example: '2026-10-08T15:30:00.000Z' })
  timestamp!: string;
}
