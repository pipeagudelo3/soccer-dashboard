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
import { CreateUserDTO } from './dto/create-user.dto.js';
import { UpdateUserDTO } from './dto/update-user.dto.js';
import { UserResponseDTO } from './dto/user-response.dto.js';
import { UsersService } from './users.service.js';

// Todos los endpoints exigen admin, incluida la consulta propia. /auth/me permite consultar el perfil propio con sesión válida.
@ApiTags('Users')
@ApiBearerAuth()
@ApiErrors(401, 403)
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Lecturas publican exclusivamente DTOs seguros; IDs mal formados producen 400.
  @Get()
  @ApiOperation({ summary: 'List users (admin)' })
  @ApiOkResponse({ type: UserResponseDTO, isArray: true })
  findAll(): Promise<UserResponseDTO[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID (admin)' })
  @ApiOkResponse({ type: UserResponseDTO })
  @ApiErrors(400, 404)
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<UserResponseDTO> {
    return this.usersService.findOne(id);
  }

  // POST devuelve 201; PATCH 200. Las reglas quedan en el servicio, no en HTTP.
  @Post()
  @ApiOperation({ summary: 'Create a user (admin)' })
  @ApiCreatedResponse({ type: UserResponseDTO })
  @ApiErrors(400, 409)
  create(
    @Body() dto: CreateUserDTO,
    @Req() request: AuthenticatedRequestInterface,
  ): Promise<UserResponseDTO> {
    return this.usersService.create(dto, request.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user; send at least one field (admin)' })
  @ApiOkResponse({ type: UserResponseDTO })
  @ApiErrors(400, 404, 409)
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
  @ApiOperation({ summary: 'Delete a user; the last admin cannot be deleted (admin)' })
  @ApiNoContentResponse({ description: 'User deleted.' })
  @ApiErrors(400, 404, 409)
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequestInterface,
  ): Promise<void> {
    return this.usersService.remove(id, request.user);
  }
}
