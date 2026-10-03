import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Repository } from 'typeorm';

import type { AuthenticatedUserInterface } from '../auth/interfaces/authenticated-user.interface.js';
import { DatabaseWriteService } from '../database/database-write.service.js';
import { getSqliteErrorCode } from '../database/sqlite-error-code.js';
import { MatchStats } from '../match-stats/entities/match-stats.entity.js';
import { Player } from '../players/entities/player.entity.js';
import { CreateTeamDTO } from './dto/create-team.dto.js';
import type { TeamResponseDTO } from './dto/team-response.dto.js';
import type { UpdateTeamDTO } from './dto/update-team.dto.js';
import { Team } from './entities/team.entity.js';
import { mapTeamResponse } from './team-response.mapper.js';

// Aplica reglas del dominio y coordina equipos, jugadores y partidos dentro de SQLite.
@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team) private readonly teamsRepository: Repository<Team>,
    private readonly databaseWriteService: DatabaseWriteService,
  ) {}

  async findAll(): Promise<TeamResponseDTO[]> {
    // Mantiene la lista completa y un orden estable, según el contrato académico.
    const teams = await this.teamsRepository.find({ order: { createdAt: 'ASC', id: 'ASC' } });
    return teams.map(mapTeamResponse);
  }

  async findOne(id: string): Promise<TeamResponseDTO> {
    return mapTeamResponse(await this.requireTeam(this.teamsRepository, id));
  }

  async create(dto: CreateTeamDTO, actor: AuthenticatedUserInterface): Promise<TeamResponseDTO> {
    return this.databaseWriteService
      .runAsAdministrator(actor, async (manager) => {
        const repository = manager.getRepository(Team);
        const fields = await this.validateFields(dto);
        await this.ensureUniqueName(repository, fields.name);
        const team = await repository.save(repository.create(fields));
        return mapTeamResponse(team);
      })
      .catch((error: unknown) => {
        throw this.translateDatabaseError(error);
      });
  }

  async update(
    id: string,
    dto: UpdateTeamDTO,
    actor: AuthenticatedUserInterface,
  ): Promise<TeamResponseDTO> {
    if (
      [dto.name, dto.logoURL, dto.country, dto.stadium, dto.foundedDate].every(
        (value) => value === undefined,
      )
    ) {
      throw new BadRequestException('Provide at least one editable team field.');
    }
    return this.databaseWriteService
      .runAsAdministrator(actor, async (manager) => {
        const repository = manager.getRepository(Team);
        const team = await this.requireTeam(repository, id);
        // Valida la entidad resultante completa, conservando solo los campos omitidos.
        const fields = await this.validateFields({
          name: dto.name === undefined ? team.name : dto.name,
          logoURL: dto.logoURL === undefined ? team.logoURL : dto.logoURL,
          country: dto.country === undefined ? team.country : dto.country,
          stadium: dto.stadium === undefined ? team.stadium : dto.stadium,
          foundedDate: dto.foundedDate === undefined ? team.foundedDate : dto.foundedDate,
        });
        await this.ensureUniqueName(repository, fields.name, id);
        Object.assign(team, fields);
        return mapTeamResponse(await repository.save(team));
      })
      .catch((error: unknown) => {
        throw this.translateDatabaseError(error);
      });
  }

  async remove(id: string, actor: AuthenticatedUserInterface): Promise<void> {
    await this.databaseWriteService
      .runAsAdministrator(actor, async (manager) => {
        const repository = manager.getRepository(Team);
        const team = await this.requireTeam(repository, id);
        // Comprueba local Y visitante antes de tocar jugadores. RESTRICT sigue siendo
        // la defensa final si otra conexión registra un partido concurrentemente.
        const hasMatches = await manager
          .getRepository(MatchStats)
          .existsBy([{ homeTeamId: id }, { awayTeamId: id }]);
        if (hasMatches)
          throw new ConflictException('A team referenced by match statistics cannot be deleted.');

        // Desvincula únicamente sus jugadores y actualiza timestamps, conservando
        // estado y estadísticas. Si falla el delete, la transacción revierte también esto.
        await manager.getRepository(Player).update(
          { teamId: id },
          {
            teamId: null,
            updatedAt: new Date(),
          },
        );
        await repository.remove(team);
      })
      .catch((error: unknown) => {
        throw this.translateDatabaseError(error);
      });
  }

  private async requireTeam(repository: Repository<Team>, id: string): Promise<Team> {
    const team = await repository.findOneBy({ id });
    if (team === null) throw new NotFoundException('Team not found.');
    return team;
  }

  private async validateFields(fields: CreateTeamDTO): Promise<CreateTeamDTO> {
    // Reutiliza DTOs para normalización y reglas; no duplica la validación del calendario.
    const normalized = plainToInstance(CreateTeamDTO, fields);
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

  private async ensureUniqueName(
    repository: Repository<Team>,
    name: string,
    currentId?: string,
  ): Promise<void> {
    // SQLite NOCASE cubre ASCII; esta comparación cubre también nombres con acentos.
    // La lista académica es pequeña y las escrituras HTTP comparten una única cola.
    const teams = await repository.find({ select: { id: true, name: true } });
    const normalizedName = name.trim().toLowerCase();
    if (
      teams.some(
        (team) => team.id !== currentId && team.name.trim().toLowerCase() === normalizedName,
      )
    ) {
      throw new ConflictException('A team with this name already exists.');
    }
  }

  private translateDatabaseError(error: unknown): unknown {
    const code = getSqliteErrorCode(error);
    if (code === 'SQLITE_CONSTRAINT_UNIQUE')
      return new ConflictException('A team with this name already exists.');
    if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || code === 'SQLITE_CONSTRAINT_TRIGGER') {
      return new ConflictException('A team referenced by match statistics cannot be deleted.');
    }
    return error;
  }
}
