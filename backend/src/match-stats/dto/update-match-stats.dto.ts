import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

import { NonNegativeInteger } from '../../common/validation/non-negative-integer.decorator.js';
import { PastOrPresentDate } from '../../common/validation/past-or-present-date.decorator.js';
import { TrimmedText } from '../../common/validation/trimmed-text.decorator.js';

// Omitir conserva el campo; null nunca reemplaza una fecha, equipo o estadística.
export class UpdateMatchStatsDTO {
  @ApiPropertyOptional({ format: 'date', example: '2026-09-20' })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @PastOrPresentDate()
  date?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsUUID('4')
  homeTeamId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsUUID('4')
  awayTeamId?: string;

  @ApiPropertyOptional({ example: 2 })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @NonNegativeInteger()
  goalsHomeTeam?: number;

  @ApiPropertyOptional({ example: 1 })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @NonNegativeInteger()
  goalsAwayTeam?: number;

  @ApiPropertyOptional({ example: 'Atanasio Girardot' })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @TrimmedText()
  stadium?: string;

  @ApiPropertyOptional({ example: 45000 })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @NonNegativeInteger()
  attendance?: number;
}
