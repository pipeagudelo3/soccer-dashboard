import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EnvironmentModule } from '../config/environment.module.js';
import type { EnvironmentConfiguration } from '../config/environment.js';
import { User } from '../users/entities/user.entity.js';
import { PasswordService } from '../users/password.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RolesGuard } from './guards/roles.guard.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { AdminGuard } from './guards/admin.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

// Registra login, perfil, estrategia y permisos con las dependencias ya instaladas.
// No importa UsersModule, evitando una dependencia circular con el CRUD.
@Module({
  imports: [
    EnvironmentModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [EnvironmentModule],
      inject: [ConfigService],
      useFactory: (configuration: ConfigService<EnvironmentConfiguration, true>) => ({
        secret: configuration.get('JWT_SECRET', { infer: true }),
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, JwtStrategy, JwtAuthGuard, RolesGuard, AdminGuard],
  // Los módulos que usan el guard también necesitan sus dependencias exportadas.
  exports: [
    TypeOrmModule,
    JwtModule,
    PasswordService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    AdminGuard,
  ],
})
export class AuthModule {}
