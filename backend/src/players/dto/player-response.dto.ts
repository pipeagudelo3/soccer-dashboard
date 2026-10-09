import { ApiProperty } from '@nestjs/swagger';

import { BaseResponseDTO } from '../../common/dto/base-response.dto.js';
import type { Player } from '../entities/player.entity.js';
import { PLAYER_STATUSES } from './player-validation.decorators.js';

// Mantiene exactamente las nueve propiedades de PlayerInterface del frontend.
export class PlayerResponseDTO extends BaseResponseDTO {
  @ApiProperty({ example: 'Juan Pérez' })
  name!: string;

  @ApiProperty({ example: 'Forward' })
  position!: string;

  @ApiProperty({ enum: PLAYER_STATUSES })
  status!: Player['status'];

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  teamId!: string | null;

  @ApiProperty({ example: 12 })
  goals!: number;

  @ApiProperty({ example: 7 })
  assists!: number;
}
