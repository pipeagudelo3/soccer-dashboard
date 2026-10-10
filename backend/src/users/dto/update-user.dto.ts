import { ApiPropertyOptional } from '@nestjs/swagger';
import { ValidateIf } from 'class-validator';

import {
  USER_ROLES,
  UserEmail,
  UserName,
  UserPassword,
  UserRole,
} from './user-validation.decorators.js';

// Omitir un campo lo conserva. Null y password vacío se rechazan deliberadamente.
// IsOptional permitiría null; ValidateIf omite solamente valores undefined.
export class UpdateUserDTO {
  @ApiPropertyOptional({ example: 'Ana Torres' })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @UserName()
  name?: string;

  @ApiPropertyOptional({ example: 'ana@soccer.example' })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @UserEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'NewSecret123' })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @UserPassword()
  password?: string;

  @ApiPropertyOptional({ enum: USER_ROLES })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @UserRole()
  role?: 'admin' | 'user';
}
