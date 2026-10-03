import { ValidateIf } from 'class-validator';

import { UserEmail, UserName, UserPassword, UserRole } from './user-validation.decorators.js';

// Omitir un campo lo conserva. Null y password vacío se rechazan deliberadamente.
// IsOptional permitiría null; ValidateIf omite solamente valores undefined.
export class UpdateUserDTO {
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @UserName()
  name?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @UserEmail()
  email?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @UserPassword()
  password?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @UserRole()
  role?: 'admin' | 'user';
}
