import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { Player } from './entities/player.entity.js';
import { PlayersController } from './players.controller.js';
import { PlayersService } from './players.service.js';

// Reutiliza guards y acceso transaccional sin importar TeamsModule ni crear ciclos.
@Module({
  imports: [TypeOrmModule.forFeature([Player]), AuthModule],
  controllers: [PlayersController],
  providers: [PlayersService],
  exports: [TypeOrmModule, PlayersService],
})
export class PlayersModule {}
