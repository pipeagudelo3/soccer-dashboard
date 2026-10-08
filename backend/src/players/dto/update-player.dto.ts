import { ValidateIf } from 'class-validator';

import { TrimmedText } from '../../common/validation/trimmed-text.decorator.js';
import type { Player } from '../entities/player.entity.js';
import { PlayerStatistic, PlayerStatus, PlayerTeamId } from './player-validation.decorators.js';

// Omitir conserva el campo; solo teamId admite null como desvinculación explícita.
export class UpdatePlayerDTO {
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @TrimmedText()
  name?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @TrimmedText()
  position?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @PlayerStatus()
  status?: Player['status'];

  @PlayerTeamId(true)
  teamId?: string | null;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @PlayerStatistic()
  goals?: number;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @PlayerStatistic()
  assists?: number;
}
