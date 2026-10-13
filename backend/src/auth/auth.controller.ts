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
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiErrors } from '../common/swagger/api-errors.decorator.js';
import { UserResponseDTO } from '../users/dto/user-response.dto.js';
import { AuthService } from './auth.service.js';
import { LoginDTO } from './dto/login.dto.js';
import { LoginResponseDTO } from './dto/login-response.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import type { AuthenticatedRequestInterface } from './interfaces/authenticated-user.interface.js';

// Impide almacenamiento en cachés HTTP; el token solo se entrega en login.
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Log in and get an access token (public)' })
  @ApiOkResponse({ type: LoginResponseDTO })
  @ApiErrors(400, 401)
  login(@Body() dto: LoginDTO): Promise<LoginResponseDTO> {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'no-store')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the profile of the authenticated user' })
  @ApiOkResponse({ type: UserResponseDTO })
  @ApiErrors(401)
  me(@Req() request: AuthenticatedRequestInterface): Promise<UserResponseDTO> {
    return this.authService.me(request.user);
  }
}
