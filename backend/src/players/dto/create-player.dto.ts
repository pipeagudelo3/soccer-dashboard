import { TrimmedText } from '../../common/validation/trimmed-text.decorator.js';
import type { Player } from '../entities/player.entity.js';
import { PlayerStatistic, PlayerStatus, PlayerTeamId } from './player-validation.decorators.js';

// Los seis campos editables son obligatorios; el servidor genera ID y timestamps.
export class CreatePlayerDTO {
  @TrimmedText()
  name!: string;

  @TrimmedText()
  position!: string;

  @PlayerStatus()
  status!: Player['status'];

  @PlayerTeamId()
  teamId!: string | null;

  @PlayerStatistic()
  goals!: number;

  @PlayerStatistic()
  assists!: number;
}
