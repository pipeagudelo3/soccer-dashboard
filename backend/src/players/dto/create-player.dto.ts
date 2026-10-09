import { ApiProperty } from '@nestjs/swagger';

import { TrimmedText } from '../../common/validation/trimmed-text.decorator.js';
import type { Player } from '../entities/player.entity.js';
import {
  PLAYER_STATUSES,
  PlayerStatistic,
  PlayerStatus,
  PlayerTeamId,
} from './player-validation.decorators.js';

// Los seis campos editables son obligatorios; el servidor genera ID y timestamps.
export class CreatePlayerDTO {
  @ApiProperty({ example: 'Juan Pérez' })
  @TrimmedText()
  name!: string;

  @ApiProperty({ example: 'Forward' })
  @TrimmedText()
  position!: string;

  @ApiProperty({ enum: PLAYER_STATUSES, example: 'active' })
  @PlayerStatus()
  status!: Player['status'];

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'Existing team ID, or null for a player without team.',
  })
  @PlayerTeamId()
  teamId!: string | null;

  @ApiProperty({ example: 12 })
  @PlayerStatistic()
  goals!: number;

  @ApiProperty({ example: 7 })
  @PlayerStatistic()
  assists!: number;
}
