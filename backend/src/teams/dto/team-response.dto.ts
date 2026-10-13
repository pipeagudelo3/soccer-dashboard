import { ApiProperty } from '@nestjs/swagger';

import { BaseResponseDTO } from '../../common/dto/base-response.dto.js';

// Publica solamente el equipo aprobado, sin entidades anidadas ni arrays de relaciones.
export class TeamResponseDTO extends BaseResponseDTO {
  @ApiProperty({ example: 'Atlético Nacional' })
  name!: string;

  @ApiProperty({ example: 'https://example.com/logos/atletico-nacional.png' })
  logoURL!: string;

  @ApiProperty({ example: 'Colombia' })
  country!: string;

  @ApiProperty({ example: 'Atanasio Girardot' })
  stadium!: string;

  @ApiProperty({ format: 'date', example: '1947-03-07' })
  foundedDate!: string;
}
