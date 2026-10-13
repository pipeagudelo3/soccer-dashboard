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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedRequestInterface } from '../auth/interfaces/authenticated-user.interface.js';
import { ApiErrors } from '../common/swagger/api-errors.decorator.js';
import { CreateMatchStatsDTO } from './dto/create-match-stats.dto.js';
import { MatchStatsResponseDTO } from './dto/match-stats-response.dto.js';
import { UpdateMatchStatsDTO } from './dto/update-match-stats.dto.js';
import { MatchStatsService } from './match-stats.service.js';

// Lecturas autenticadas y mutaciones administrativas, coherentes con Teams.
@ApiTags('Match stats')
@ApiBearerAuth()
@ApiErrors(401)
@Controller('match-stats')
@UseGuards(JwtAuthGuard)
export class MatchStatsController {
  constructor(private readonly matchStatsService: MatchStatsService) {}

  @Get()
  @ApiOperation({ summary: 'List match statistics' })
  @ApiOkResponse({ type: MatchStatsResponseDTO, isArray: true })
  findAll(): Promise<MatchStatsResponseDTO[]> {
    return this.matchStatsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get match statistics by ID' })
  @ApiOkResponse({ type: MatchStatsResponseDTO })
  @ApiErrors(400, 404)
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<MatchStatsResponseDTO> {
    return this.matchStatsService.findOne(id);
  }

  // Los pipes validan la entrada y el servicio conserva la autoridad de negocio.
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Create match statistics between two different teams (admin)' })
  @ApiCreatedResponse({ type: MatchStatsResponseDTO })
  @ApiErrors(400, 403, 409)
  create(
    @Body() dto: CreateMatchStatsDTO,
    @Req() request: AuthenticatedRequestInterface,
  ): Promise<MatchStatsResponseDTO> {
    return this.matchStatsService.create(dto, request.user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update match statistics; send at least one field (admin)' })
  @ApiOkResponse({ type: MatchStatsResponseDTO })
  @ApiErrors(400, 403, 404, 409)
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
  @ApiOperation({ summary: 'Delete match statistics (admin)' })
  @ApiNoContentResponse({ description: 'Match statistics deleted.' })
  @ApiErrors(400, 403, 404)
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequestInterface,
  ): Promise<void> {
    return this.matchStatsService.remove(id, request.user);
  }
}
