import { ApiProperty } from '@nestjs/swagger';

import {
  USER_ROLES,
  UserEmail,
  UserName,
  UserPassword,
  UserRole,
} from './user-validation.decorators.js';

// Todos los campos son obligatorios; IDs, timestamps y hashes no son entradas HTTP.
export class CreateUserDTO {
  @ApiProperty({ example: 'Ana Torres' })
  @UserName()
  name!: string;

  @ApiProperty({ example: 'ana@soccer.example', description: 'Unique; stored in lowercase.' })
  @UserEmail()
  email!: string;

  @ApiProperty({
    example: 'Secret123',
    description: 'Min. 8 characters with uppercase, lowercase and a number; max. 72 UTF-8 bytes.',
  })
  @UserPassword()
  password!: string;

  @ApiProperty({ enum: USER_ROLES, example: 'user' })
  @UserRole()
  role!: 'admin' | 'user';
}
