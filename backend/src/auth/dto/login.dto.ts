import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

import { UserEmail } from '../../users/dto/user-validation.decorators.js';

// Normaliza el email; la contraseña no se recorta ni se convierte de tipo.
export class LoginDTO {
  @ApiProperty({ example: 'admin@soccer.example' })
  @UserEmail()
  email!: string;

  @ApiProperty({ example: 'AdminDemo123' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
