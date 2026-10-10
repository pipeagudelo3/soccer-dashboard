import { applyDecorators } from '@nestjs/common';
import { IsUrl } from 'class-validator';

import { PastOrPresentDate } from '../../common/validation/past-or-present-date.decorator.js';
import { TrimmedText } from '../../common/validation/trimmed-text.decorator.js';

// Comparte trim y validación de texto entre POST y PATCH; no convierte otros tipos.
export function TeamText(): PropertyDecorator {
  return TrimmedText();
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
  return PastOrPresentDate();
}
