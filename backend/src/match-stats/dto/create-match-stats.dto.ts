import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

import { NonNegativeInteger } from '../../common/validation/non-negative-integer.decorator.js';
import { PastOrPresentDate } from '../../common/validation/past-or-present-date.decorator.js';
import { TrimmedText } from '../../common/validation/trimmed-text.decorator.js';

// Los siete campos editables son obligatorios; no acepta objetos Team ni datos del servidor.
export class CreateMatchStatsDTO {
  @ApiProperty({ format: 'date', example: '2026-09-20', description: 'Not in the future.' })
  @PastOrPresentDate()
  date!: string;

  @ApiProperty({ format: 'uuid', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsUUID('4')
  homeTeamId!: string;

  @ApiProperty({
    format: 'uuid',
    example: '9b2f6a4e-3c1d-4e8a-8f57-2d6c1a7b9e30',
    description: 'Must differ from homeTeamId.',
  })
  @IsUUID('4')
  awayTeamId!: string;

  @ApiProperty({ example: 2 })
  @NonNegativeInteger()
  goalsHomeTeam!: number;

  @ApiProperty({ example: 1 })
  @NonNegativeInteger()
  goalsAwayTeam!: number;

  @ApiProperty({ example: 'Atanasio Girardot' })
  @TrimmedText()
  stadium!: string;

  @ApiProperty({ example: 45000 })
  @NonNegativeInteger()
  attendance!: number;
}
