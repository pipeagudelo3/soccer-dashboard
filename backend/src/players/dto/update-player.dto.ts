import { ApiPropertyOptional } from '@nestjs/swagger';
import { ValidateIf } from 'class-validator';

import { TrimmedText } from '../../common/validation/trimmed-text.decorator.js';
import type { Player } from '../entities/player.entity.js';
import {
  PLAYER_STATUSES,
  PlayerStatistic,
  PlayerStatus,
  PlayerTeamId,
} from './player-validation.decorators.js';

// Omitir conserva el campo; solo teamId admite null como desvinculación explícita.
export class UpdatePlayerDTO {
  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @TrimmedText()
  name?: string;

  @ApiPropertyOptional({ example: 'Forward' })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @TrimmedText()
  position?: string;

  @ApiPropertyOptional({ enum: PLAYER_STATUSES })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @PlayerStatus()
  status?: Player['status'];

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Existing team ID; null unlinks the team.',
  })
  @PlayerTeamId(true)
  teamId?: string | null;

  @ApiPropertyOptional({ example: 12 })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @PlayerStatistic()
  goals?: number;

  @ApiPropertyOptional({ example: 7 })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @PlayerStatistic()
  assists?: number;
}
