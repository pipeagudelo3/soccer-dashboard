import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { EntityManager, Repository } from 'typeorm';

import type { AuthenticatedUserInterface } from '../auth/interfaces/authenticated-user.interface.js';
import { DatabaseWriteService } from '../database/database-write.service.js';
import { getSqliteErrorCode } from '../database/sqlite-error-code.js';
import { Team } from '../teams/entities/team.entity.js';
import { CreatePlayerDTO } from './dto/create-player.dto.js';
import type { PlayerResponseDTO } from './dto/player-response.dto.js';
import type { UpdatePlayerDTO } from './dto/update-player.dto.js';
import { Player } from './entities/player.entity.js';
import { mapPlayerResponse } from './player-response.mapper.js';

// Aplica reglas del jugador y valida la FK dentro de la misma transacción de escritura.
@Injectable()
export class PlayersService {
  constructor(
    @InjectRepository(Player) private readonly playersRepository: Repository<Player>,
    private readonly databaseWriteService: DatabaseWriteService,
  ) {}

  async findAll(): Promise<PlayerResponseDTO[]> {
    const players = await this.playersRepository.find({ order: { createdAt: 'ASC', id: 'ASC' } });
    return players.map(mapPlayerResponse);
  }

  async findOne(id: string): Promise<PlayerResponseDTO> {
    return mapPlayerResponse(await this.requirePlayer(this.playersRepository, id));
  }

  async create(
    dto: CreatePlayerDTO,
    actor: AuthenticatedUserInterface,
  ): Promise<PlayerResponseDTO> {
    return this.databaseWriteService
      .runAsAdministrator(actor, async (manager) => {
        const fields = await this.validateFields(dto);
        await this.ensureTeamExists(manager, fields.teamId);
        const repository = manager.getRepository(Player);
        return mapPlayerResponse(await repository.save(repository.create(fields)));
      })
      .catch((error: unknown) => {
        throw this.translateDatabaseError(error);
      });
  }

  async update(
    id: string,
    dto: UpdatePlayerDTO,
    actor: AuthenticatedUserInterface,
  ): Promise<PlayerResponseDTO> {
    if (
      [dto.name, dto.position, dto.status, dto.teamId, dto.goals, dto.assists].every(
        (value) => value === undefined,
      )
    )
      throw new BadRequestException('Provide at least one editable player field.');

    return this.databaseWriteService
      .runAsAdministrator(actor, async (manager) => {
        const repository = manager.getRepository(Player);
        const player = await this.requirePlayer(repository, id);
        // Solo undefined conserva el valor: null no equivale a omitir, y cero es válido.
        const fields = await this.validateFields({
          name: dto.name === undefined ? player.name : dto.name,
          position: dto.position === undefined ? player.position : dto.position,
          status: dto.status === undefined ? player.status : dto.status,
          teamId: dto.teamId === undefined ? player.teamId : dto.teamId,
          goals: dto.goals === undefined ? player.goals : dto.goals,
          assists: dto.assists === undefined ? player.assists : dto.assists,
        });
        await this.ensureTeamExists(manager, fields.teamId);
        Object.assign(player, fields);
        return mapPlayerResponse(await repository.save(player));
      })
      .catch((error: unknown) => {
        throw this.translateDatabaseError(error);
      });
  }

  async remove(id: string, actor: AuthenticatedUserInterface): Promise<void> {
    await this.databaseWriteService.runAsAdministrator(actor, async (manager) => {
      const repository = manager.getRepository(Player);
      await repository.remove(await this.requirePlayer(repository, id));
    });
  }

  private async requirePlayer(repository: Repository<Player>, id: string): Promise<Player> {
    const player = await repository.findOneBy({ id });
    if (player === null) throw new NotFoundException('Player not found.');
    return player;
  }

  private async validateFields(fields: CreatePlayerDTO): Promise<CreatePlayerDTO> {
    const normalized = plainToInstance(CreatePlayerDTO, fields);
    const errors = await validate(normalized, {
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    });
    if (errors.length > 0) {
      throw new BadRequestException(
        errors.flatMap((error) => Object.values(error.constraints ?? {})),
      );
    }
    return normalized;
  }

  private async ensureTeamExists(manager: EntityManager, teamId: string | null): Promise<void> {
    if (teamId !== null && !(await manager.getRepository(Team).existsBy({ id: teamId }))) {
      throw new BadRequestException('Select an existing team or leave the player unassigned.');
    }
  }

  private translateDatabaseError(error: unknown): unknown {
    // Las FK siguen siendo defensa final frente a cambios desde otra conexión SQLite.
    if (getSqliteErrorCode(error) === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return new BadRequestException('Select an existing team or leave the player unassigned.');
    }
    return error;
  }
}
