import { ApiProperty } from '@nestjs/swagger';

import { BaseResponseDTO } from '../../common/dto/base-response.dto.js';
import { USER_ROLES } from './user-validation.decorators.js';

// Delimita el perfil público: ninguna respuesta puede incluir passwordHash.
export class UserResponseDTO extends BaseResponseDTO {
  @ApiProperty({ example: 'Ana Torres' })
  name!: string;

  @ApiProperty({ example: 'ana@soccer.example' })
  email!: string;

  @ApiProperty({ enum: USER_ROLES })
  role!: 'admin' | 'user';
}
