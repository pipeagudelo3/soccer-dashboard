import { ApiProperty } from '@nestjs/swagger';

import { BaseResponseDTO } from '../../common/dto/base-response.dto.js';

// Contrato normalizado del frontend, sin nombres ni objetos de equipo embebidos.
export class MatchStatsResponseDTO extends BaseResponseDTO {
  @ApiProperty({ format: 'date', example: '2026-09-20' })
  date!: string;

  @ApiProperty({ format: 'uuid' })
  homeTeamId!: string;

  @ApiProperty({ format: 'uuid' })
  awayTeamId!: string;

  @ApiProperty({ example: 2 })
  goalsHomeTeam!: number;

  @ApiProperty({ example: 1 })
  goalsAwayTeam!: number;

  @ApiProperty({ example: 'Atanasio Girardot' })
  stadium!: string;

  @ApiProperty({ example: 45000 })
  attendance!: number;
}
