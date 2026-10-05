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
import { CreateMatchStatsDTO } from './dto/create-match-stats.dto.js';
import type { MatchStatsResponseDTO } from './dto/match-stats-response.dto.js';
import { UpdateMatchStatsDTO } from './dto/update-match-stats.dto.js';
import { MatchStatsService } from './match-stats.service.js';

// Lecturas autenticadas y mutaciones administrativas, coherentes con Teams.
@Controller('match-stats')
@UseGuards(JwtAuthGuard)
export class MatchStatsController {
  constructor(private readonly matchStatsService: MatchStatsService) {}

  @Get()
  findAll(): Promise<MatchStatsResponseDTO[]> {
    return this.matchStatsService.findAll();
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<MatchStatsResponseDTO> {
    return this.matchStatsService.findOne(id);
  }

  // Los pipes validan la entrada y el servicio conserva la autoridad de negocio.
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(
    @Body() dto: CreateMatchStatsDTO,
    @Req() request: AuthenticatedRequestInterface,
  ): Promise<MatchStatsResponseDTO> {
    return this.matchStatsService.create(dto, request.user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateMatchStatsDTO,
    @Req() request: AuthenticatedRequestInterface,
  ): Promise<MatchStatsResponseDTO> {
    return this.matchStatsService.update(id, dto, request.user);
  }

  // DELETE devuelve 204 sin cuerpo y conserva ambos equipos relacionados.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequestInterface,
  ): Promise<void> {
    return this.matchStatsService.remove(id, request.user);
  }
}
