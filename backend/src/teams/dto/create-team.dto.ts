import { ApiProperty } from '@nestjs/swagger';

import { TeamFoundedDate, TeamLogoURL, TeamText } from './team-validation.decorators.js';

// Los cinco campos son obligatorios; no acepta IDs, timestamps ni objetos relacionados.
export class CreateTeamDTO {
  @ApiProperty({ example: 'Atlético Nacional', description: 'Unique (case-insensitive).' })
  @TeamText()
  name!: string;

  @ApiProperty({ example: 'https://example.com/logos/atletico-nacional.png' })
  @TeamLogoURL()
  logoURL!: string;

  @ApiProperty({ example: 'Colombia' })
  @TeamText()
  country!: string;

  @ApiProperty({ example: 'Atanasio Girardot' })
  @TeamText()
  stadium!: string;

  @ApiProperty({ format: 'date', example: '1947-03-07', description: 'Not in the future.' })
  @TeamFoundedDate()
  foundedDate!: string;
}
