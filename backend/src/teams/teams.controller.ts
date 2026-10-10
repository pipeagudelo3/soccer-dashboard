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
import { CreateTeamDTO } from './dto/create-team.dto.js';
import { TeamResponseDTO } from './dto/team-response.dto.js';
import { UpdateTeamDTO } from './dto/update-team.dto.js';
import { TeamsService } from './teams.service.js';

// Las lecturas requieren sesión; las mutaciones añaden autorización de administrador.
@ApiTags('Teams')
@ApiBearerAuth()
@ApiErrors(401)
@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'List teams' })
  @ApiOkResponse({ type: TeamResponseDTO, isArray: true })
  findAll(): Promise<TeamResponseDTO[]> {
    return this.teamsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a team by ID' })
  @ApiOkResponse({ type: TeamResponseDTO })
  @ApiErrors(400, 404)
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<TeamResponseDTO> {
    return this.teamsService.findOne(id);
  }

  // Los DTOs validan la entrada y el servicio decide las reglas; POST devuelve 201.
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Create a team (admin)' })
  @ApiCreatedResponse({ type: TeamResponseDTO })
  @ApiErrors(400, 403, 409)
  create(
    @Body() dto: CreateTeamDTO,
    @Req() request: AuthenticatedRequestInterface,
  ): Promise<TeamResponseDTO> {
    return this.teamsService.create(dto, request.user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update a team; send at least one field (admin)' })
  @ApiOkResponse({ type: TeamResponseDTO })
  @ApiErrors(400, 403, 404, 409)
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateTeamDTO,
    @Req() request: AuthenticatedRequestInterface,
  ): Promise<TeamResponseDTO> {
    return this.teamsService.update(id, dto, request.user);
  }

  // El contrato conserva 204 sin cuerpo cuando la eliminación está permitida.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Delete a team without matches; its players are unlinked (admin)' })
  @ApiNoContentResponse({ description: 'Team deleted.' })
  @ApiErrors(400, 403, 404, 409)
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequestInterface,
  ): Promise<void> {
    return this.teamsService.remove(id, request.user);
  }
}
