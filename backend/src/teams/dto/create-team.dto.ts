import { TeamFoundedDate, TeamLogoURL, TeamText } from './team-validation.decorators.js';

// Los cinco campos son obligatorios; no acepta IDs, timestamps ni objetos relacionados.
export class CreateTeamDTO {
  @TeamText()
  name!: string;

  @TeamLogoURL()
  logoURL!: string;

  @TeamText()
  country!: string;

  @TeamText()
  stadium!: string;

  @TeamFoundedDate()
  foundedDate!: string;
}
