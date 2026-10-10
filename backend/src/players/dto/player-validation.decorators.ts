import { applyDecorators } from '@nestjs/common';
import { IsIn, IsUUID, ValidateIf } from 'class-validator';

import { NonNegativeInteger } from '../../common/validation/non-negative-integer.decorator.js';
import { TrimmedText } from '../../common/validation/trimmed-text.decorator.js';

// Estados del frontend; validación y documentación OpenAPI usan la misma lista.
export const PLAYER_STATUSES = ['active', 'injured', 'suspended', 'free-agent'] as const;

// No impone un estado al desvincular un equipo.
export function PlayerStatus(): PropertyDecorator {
  return applyDecorators(TrimmedText(), IsIn(PLAYER_STATUSES));
}

// IsInt rechaza NaN e infinito; Max mantiene precisión JSON y coincide con el CHECK SQLite.
export function PlayerStatistic(): PropertyDecorator {
  return NonNegativeInteger();
}

// null es válido; POST exige un UUID o null explícito, PATCH puede omitir la relación.
export function PlayerTeamId(isUpdate = false): PropertyDecorator {
  return applyDecorators(
    ValidateIf(
      (_object: unknown, value: unknown) => value !== null && (!isUpdate || value !== undefined),
    ),
    IsUUID('4'),
  );
}
