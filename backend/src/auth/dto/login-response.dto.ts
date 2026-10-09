import { ApiProperty } from '@nestjs/swagger';

import { UserResponseDTO } from '../../users/dto/user-response.dto.js';

// Solo este endpoint entrega el access token; el perfil excluye credenciales.
export class LoginResponseDTO {
  @ApiProperty({ description: 'JWT signed with HS256; send it as a Bearer token.' })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ description: 'Token lifetime in seconds.', example: 900 })
  expiresIn!: number;

  @ApiProperty({ type: UserResponseDTO })
  user!: UserResponseDTO;
}
