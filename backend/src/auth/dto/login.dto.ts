import { IsNotEmpty, IsString } from 'class-validator';

import { UserEmail } from '../../users/dto/user-validation.decorators.js';

// Normaliza el email; la contraseña no se recorta ni se convierte de tipo.
export class LoginDTO {
  @UserEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
