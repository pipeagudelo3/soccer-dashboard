import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EnvironmentModule } from '../config/environment.module.js';
import type { EnvironmentConfiguration } from '../config/environment.js';
import { User } from '../users/entities/user.entity.js';
import { AdminGuard } from './guards/admin.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

// Aporta solamente verificación de sesión y permisos. Login y /auth/me quedan para #47.
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
  providers: [JwtAuthGuard, AdminGuard],
  // Los módulos que usan el guard también necesitan sus dependencias exportadas.
  exports: [TypeOrmModule, JwtModule, JwtAuthGuard, AdminGuard],
})
export class AuthModule {}
