import { applyDecorators } from '@nestjs/common';
import { ValidateBy } from 'class-validator';

import { isPastOrPresentCivilDate } from './civil-date.validator.js';
import { TrimmedText } from './trimmed-text.decorator.js';

// Comparte calendario real y corte UTC entre fechas de equipos y partidos.
export function PastOrPresentDate(): PropertyDecorator {
  return applyDecorators(
    TrimmedText(),
    ValidateBy({
      name: 'pastOrPresentCivilDate',
      validator: {
        validate: (value: unknown): boolean => isPastOrPresentCivilDate(value),
        defaultMessage: (argumentsValue) =>
          `${argumentsValue?.property ?? 'date'} must be a real YYYY-MM-DD date that is not in the future`,
      },
    }),
  );
}
