import { randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { getJwtExpirationSeconds } from '../config/environment.js';
import type { EnvironmentConfiguration } from '../config/environment.js';
import type { UserResponseDTO } from '../users/dto/user-response.dto.js';
import { User } from '../users/entities/user.entity.js';
import { PasswordService } from '../users/password.service.js';
import type { LoginDTO } from './dto/login.dto.js';
import type { LoginResponseDTO } from './dto/login-response.dto.js';
import type { AuthenticatedUserInterface } from './interfaces/authenticated-user.interface.js';

// Separa credenciales y perfil público; no escribe ni registra passwords, hashes o JWT.
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly dummyPasswordHash: Promise<string>;
  private readonly expiresIn: number;

  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    configuration: ConfigService<EnvironmentConfiguration, true>,
  ) {
    this.expiresIn = getJwtExpirationSeconds(configuration.get('JWT_EXPIRES_IN', { infer: true }));
    // Un email inexistente también paga una comparación bcrypt de coste 12.
    this.dummyPasswordHash = passwordService.hashPassword(`${randomBytes(24).toString('hex')}Aa1`);
  }

  async onModuleInit(): Promise<void> {
    await this.dummyPasswordHash;
  }

  async login(dto: LoginDTO): Promise<LoginResponseDTO> {
    // Evita la aceptación por truncamiento bcrypt sin cambiar la contraseña ingresada.
    if (Buffer.byteLength(dto.password, 'utf8') > 72) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersRepository.findOne({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        passwordHash: true,
      },
    });
    const hash = user?.passwordHash ?? (await this.dummyPasswordHash);
    const isValid = await this.passwordService.verifyPassword(dto.password, hash);
    if (user === null || !isValid || !['admin', 'user'].includes(user.role)) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id },
      { algorithm: 'HS256', expiresIn: this.expiresIn },
    );
    return { accessToken, tokenType: 'Bearer', expiresIn: this.expiresIn, user: user.toJSON() };
  }

  async me(actor: AuthenticatedUserInterface): Promise<UserResponseDTO> {
    const user = await this.usersRepository.findOneBy({ id: actor.id });
    if (user === null || !['admin', 'user'].includes(user.role)) {
      throw new UnauthorizedException('The session is invalid or expired.');
    }
    return user.toJSON();
  }
}
