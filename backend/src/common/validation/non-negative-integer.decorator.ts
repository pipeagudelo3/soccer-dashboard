import { applyDecorators } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';

// Mantiene precisión JSON y coincide con los CHECK de estadísticas en SQLite.
export function NonNegativeInteger(): PropertyDecorator {
  return applyDecorators(IsInt(), Min(0), Max(Number.MAX_SAFE_INTEGER));
}
