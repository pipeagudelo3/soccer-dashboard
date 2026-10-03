import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MatchStats } from './entities/match-stats.entity.js';

// Registra y exporta el repositorio del dominio; todavía no implementa endpoints CRUD.
@Module({
  imports: [TypeOrmModule.forFeature([MatchStats])],
  exports: [TypeOrmModule],
})
export class MatchStatsModule {}
