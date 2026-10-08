import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { UserResponseDTO } from '../users/dto/user-response.dto.js';
import { AuthService } from './auth.service.js';
import { LoginDTO } from './dto/login.dto.js';
import type { LoginResponseDTO } from './dto/login-response.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import type { AuthenticatedRequestInterface } from './interfaces/authenticated-user.interface.js';

// Impide almacenamiento en cachés HTTP; el token solo se entrega en login.
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  login(@Body() dto: LoginDTO): Promise<LoginResponseDTO> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  me(@Req() request: AuthenticatedRequestInterface): Promise<UserResponseDTO> {
    return this.authService.me(request.user);
  }
}
