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

import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedRequestInterface } from '../auth/interfaces/authenticated-user.interface.js';
import { CreatePlayerDTO } from './dto/create-player.dto.js';
import type { PlayerResponseDTO } from './dto/player-response.dto.js';
import { UpdatePlayerDTO } from './dto/update-player.dto.js';
import { PlayersService } from './players.service.js';

// Lecturas autenticadas y mutaciones administrativas, coherentes con Teams.
@Controller('players')
@UseGuards(JwtAuthGuard)
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  findAll(): Promise<PlayerResponseDTO[]> {
    return this.playersService.findAll();
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PlayerResponseDTO> {
    return this.playersService.findOne(id);
  }

  // Los pipes validan la entrada y el servicio conserva la autoridad de negocio.
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(
    @Body() dto: CreatePlayerDTO,
    @Req() request: AuthenticatedRequestInterface,
  ): Promise<PlayerResponseDTO> {
    return this.playersService.create(dto, request.user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePlayerDTO,
    @Req() request: AuthenticatedRequestInterface,
  ): Promise<PlayerResponseDTO> {
    return this.playersService.update(id, dto, request.user);
  }

  // DELETE devuelve 204 sin cuerpo y no elimina el equipo relacionado.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequestInterface,
  ): Promise<void> {
    return this.playersService.remove(id, request.user);
  }
}
