import { UserEmail, UserName, UserPassword, UserRole } from './user-validation.decorators.js';

// Todos los campos son obligatorios; IDs, timestamps y hashes no son entradas HTTP.
export class CreateUserDTO {
  @UserName()
  name!: string;

  @UserEmail()
  email!: string;

  @UserPassword()
  password!: string;

  @UserRole()
  role!: 'admin' | 'user';
}
