import { MatchStats } from '../match-stats/entities/match-stats.entity.js';
import { Player } from '../players/entities/player.entity.js';
import { Team } from '../teams/entities/team.entity.js';
import { User } from '../users/entities/user.entity.js';

// Usa el mismo conjunto canónico en Nest, CLI y pruebas, sin rutas a archivos .ts/.js.
export const domainEntities = [User, Team, Player, MatchStats];
