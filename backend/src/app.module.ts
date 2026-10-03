import { Module } from '@nestjs/common';

import { EnvironmentModule } from './config/environment.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { MatchStatsModule } from './match-stats/match-stats.module.js';
import { PlayersModule } from './players/players.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { UsersModule } from './users/users.module.js';

// Integra CRUD de usuarios y equipos; jugadores y partidos mantienen sus repositorios.
@Module({
  imports: [
    EnvironmentModule,
    DatabaseModule,
    UsersModule,
    TeamsModule,
    PlayersModule,
    MatchStatsModule,
    HealthModule,
  ],
})
export class AppModule {}
