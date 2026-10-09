import { ApiPropertyOptional } from '@nestjs/swagger';
import { ValidateIf } from 'class-validator';

import { TeamFoundedDate, TeamLogoURL, TeamText } from './team-validation.decorators.js';

// Omitir conserva el campo. ValidateIf evita que null se trate como un valor opcional.
export class UpdateTeamDTO {
  @ApiPropertyOptional({ example: 'Atlético Nacional' })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @TeamText()
  name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logos/atletico-nacional.png' })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @TeamLogoURL()
  logoURL?: string;

  @ApiPropertyOptional({ example: 'Colombia' })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @TeamText()
  country?: string;

  @ApiPropertyOptional({ example: 'Atanasio Girardot' })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @TeamText()
  stadium?: string;

  @ApiPropertyOptional({ format: 'date', example: '1947-03-07' })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @TeamFoundedDate()
  foundedDate?: string;
}
