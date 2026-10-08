import { IsUUID, ValidateIf } from 'class-validator';

import { NonNegativeInteger } from '../../common/validation/non-negative-integer.decorator.js';
import { PastOrPresentDate } from '../../common/validation/past-or-present-date.decorator.js';
import { TrimmedText } from '../../common/validation/trimmed-text.decorator.js';

// Omitir conserva el campo; null nunca reemplaza una fecha, equipo o estadística.
export class UpdateMatchStatsDTO {
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @PastOrPresentDate()
  date?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsUUID('4')
  homeTeamId?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsUUID('4')
  awayTeamId?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @NonNegativeInteger()
  goalsHomeTeam?: number;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @NonNegativeInteger()
  goalsAwayTeam?: number;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @TrimmedText()
  stadium?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @NonNegativeInteger()
  attendance?: number;
}
