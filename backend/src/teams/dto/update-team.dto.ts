import { ValidateIf } from 'class-validator';

import { TeamFoundedDate, TeamLogoURL, TeamText } from './team-validation.decorators.js';

// Omitir conserva el campo. ValidateIf evita que null se trate como un valor opcional.
export class UpdateTeamDTO {
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @TeamText()
  name?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @TeamLogoURL()
  logoURL?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @TeamText()
  country?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @TeamText()
  stadium?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @TeamFoundedDate()
  foundedDate?: string;
}
