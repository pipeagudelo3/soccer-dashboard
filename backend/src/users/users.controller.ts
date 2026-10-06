import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AdminGuard } from '../auth/guards/admin.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedRequestInterface } from '../auth/interfaces/authenticated-user.interface.js';
import { CreateUserDTO } from './dto/create-user.dto.js';
import { UpdateUserDTO } from './dto/update-user.dto.js';
import type { UserResponseDTO } from './dto/user-response.dto.js';
import { UsersService } from './users.service.js';

// Todos los endpoints exigen admin, incluida la consulta propia. /auth/me será #47.
@Controller('users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Lecturas publican exclusivamente DTOs seguros; IDs mal formados producen 400.
  @Get()
  findAll(): Promise<UserResponseDTO[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<UserResponseDTO> {
    return this.usersService.findOne(id);
  }

  // POST devuelve 201; PATCH 200. Las reglas quedan en el servicio, no en HTTP.
  @Post()
  create(
    @Body() dto: CreateUserDTO,
    @Req() request: AuthenticatedRequestInterface,
  ): Promise<UserResponseDTO> {
    return this.usersService.create(dto, request.user);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateUserDTO,
    @Req() request: AuthenticatedRequestInterface,
  ): Promise<UserResponseDTO> {
    return this.usersService.update(id, dto, request.user);
  }

  // DELETE no devuelve JSON ni perfiles, conservando el contrato 204.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequestInterface,
  ): Promise<void> {
    return this.usersService.remove(id, request.user);
  }
}
