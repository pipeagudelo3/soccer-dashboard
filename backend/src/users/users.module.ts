import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { User } from './entities/user.entity.js';
import { PasswordService } from './password.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

// Registra CRUD, repositorio, política de hash y guards reutilizables de autenticación.
@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule],
  controllers: [UsersController],
  providers: [PasswordService, UsersService],
  exports: [TypeOrmModule, PasswordService, UsersService],
})
export class UsersModule {}
