import { IsUUID } from 'class-validator';

import { NonNegativeInteger } from '../../common/validation/non-negative-integer.decorator.js';
import { PastOrPresentDate } from '../../common/validation/past-or-present-date.decorator.js';
import { TrimmedText } from '../../common/validation/trimmed-text.decorator.js';

// Los siete campos editables son obligatorios; no acepta objetos Team ni datos del servidor.
export class CreateMatchStatsDTO {
  @PastOrPresentDate()
  date!: string;

  @IsUUID('4')
  homeTeamId!: string;

  @IsUUID('4')
  awayTeamId!: string;

  @NonNegativeInteger()
  goalsHomeTeam!: number;

  @NonNegativeInteger()
  goalsAwayTeam!: number;

  @TrimmedText()
  stadium!: string;

  @NonNegativeInteger()
  attendance!: number;
}
