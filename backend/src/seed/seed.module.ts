import { Module } from '@nestjs/common';

import { EnvironmentModule } from '../config/environment.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { MatchStatsModule } from '../match-stats/match-stats.module.js';
import { PlayersModule } from '../players/players.module.js';
import { TeamsModule } from '../teams/teams.module.js';
import { UsersModule } from '../users/users.module.js';
import { SeedService } from './seed.service.js';

// Contexto exclusivo del CLI: AppModule no importa este módulo ni ejecuta seed al iniciar.
@Module({
  imports: [
    EnvironmentModule,
    DatabaseModule,
    UsersModule,
    TeamsModule,
    PlayersModule,
    MatchStatsModule,
  ],
  providers: [SeedService],
})
export class SeedModule {}
