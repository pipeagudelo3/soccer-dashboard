import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

import { ApiErrorResponseDTO } from '../dto/api-error-response.dto.js';

const ERROR_DESCRIPTIONS = {
  400: 'Validation failed, unknown property or malformed identifier.',
  401: 'Missing, invalid or expired bearer token.',
  403: 'Administrator access is required.',
  404: 'Resource not found.',
  409: 'The change conflicts with existing data.',
} as const;

// Documenta cada error con el formato común sin repetir el esquema en cada endpoint.
export function ApiErrors(
  ...statuses: (keyof typeof ERROR_DESCRIPTIONS)[]
): ReturnType<typeof applyDecorators> {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({ status, description: ERROR_DESCRIPTIONS[status], type: ApiErrorResponseDTO }),
    ),
  );
}
