import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Player } from './entities/player.entity.js';

// Registra y exporta el repositorio del dominio; todavía no implementa endpoints CRUD.
@Module({
  imports: [TypeOrmModule.forFeature([Player])],
  exports: [TypeOrmModule],
})
export class PlayersModule {}
