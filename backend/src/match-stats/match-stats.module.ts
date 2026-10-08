import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { MatchStats } from './entities/match-stats.entity.js';
import { MatchStatsController } from './match-stats.controller.js';
import { MatchStatsService } from './match-stats.service.js';

// Registra CRUD y guards compartidos, sin dependencias circulares con TeamsModule.
@Module({
  imports: [TypeOrmModule.forFeature([MatchStats]), AuthModule],
  controllers: [MatchStatsController],
  providers: [MatchStatsService],
  exports: [TypeOrmModule, MatchStatsService],
})
export class MatchStatsModule {}
