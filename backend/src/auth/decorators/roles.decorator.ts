import { SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';

import type { User } from '../../users/entities/user.entity.js';

export const ROLES_KEY = 'roles';

// El contrato admite únicamente admin/user y se aplica en clase o método.
export function Roles(...roles: User['role'][]): CustomDecorator<string> {
  return SetMetadata(ROLES_KEY, roles);
}
