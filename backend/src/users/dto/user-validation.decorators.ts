import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsString, ValidateBy } from 'class-validator';

import { isValidPassword } from '../password-policy.js';

// Recorta únicamente texto; los valores de otro tipo llegan intactos al validador.
export function UserName(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsString(),
    IsNotEmpty(),
  );
}

// Aplica la misma normalización al crear y editar, antes de comprobar la unicidad.
export function UserEmail(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
    ),
    IsString(),
    IsEmail(),
  );
}

// Valida también los bytes UTF-8: bcrypt no acepta más de 72 sin truncamiento.
export function UserPassword(): PropertyDecorator {
  return ValidateBy({
    name: 'passwordPolicy',
    validator: {
      validate: (value: unknown): boolean => isValidPassword(value),
      defaultMessage: () =>
        'password must contain at least 8 characters, uppercase, lowercase and a number, and at most 72 UTF-8 bytes',
    },
  });
}

// Limita los permisos a los dos roles del modelo aprobado.
export function UserRole(): PropertyDecorator {
  return applyDecorators(IsString(), IsIn(['admin', 'user']));
}
