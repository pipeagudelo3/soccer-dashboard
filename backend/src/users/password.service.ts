import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';

import { isValidPassword } from './password-policy.js';

// Centraliza la política de hash para usuarios, seed y auth.
@Injectable()
export class PasswordService {
  async hashPassword(password: string): Promise<string> {
    // Bcrypt no debe truncar contraseñas que superen sus 72 bytes de entrada.
    if (!isValidPassword(password)) {
      throw new Error('Password must meet the documented password policy.');
    }

    return hash(password, 12);
  }

  // Compara sin recuperar la contraseña original ni registrar valores sensibles.
  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }
}
