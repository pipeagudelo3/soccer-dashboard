import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUrl, ValidateBy } from 'class-validator';

import { isPastOrPresentCivilDate } from '../../common/validation/civil-date.validator.js';

// Comparte trim y validación de texto entre POST y PATCH; no convierte otros tipos.
export function TeamText(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsString(),
    IsNotEmpty(),
  );
}

// Solo acepta URLs absolutas HTTP/HTTPS; la API almacena la URL, nunca la descarga.
export function TeamLogoURL(): PropertyDecorator {
  return applyDecorators(
    TeamText(),
    IsUrl({
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
      require_tld: false,
    }),
  );
}

// Usa el calendario real y el día UTC actual, manteniendo el string YYYY-MM-DD.
export function TeamFoundedDate(): PropertyDecorator {
  return applyDecorators(
    TeamText(),
    ValidateBy({
      name: 'pastOrPresentCivilDate',
      validator: {
        validate: (value: unknown): boolean => isPastOrPresentCivilDate(value),
        defaultMessage: () =>
          'foundedDate must be a real YYYY-MM-DD date that is not in the future',
      },
    }),
  );
}
