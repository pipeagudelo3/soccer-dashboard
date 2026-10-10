import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { EntityManager, Repository } from 'typeorm';

import type { AuthenticatedUserInterface } from '../auth/interfaces/authenticated-user.interface.js';
import { DatabaseWriteService } from '../database/database-write.service.js';
import { getSqliteErrorCode } from '../database/sqlite-error-code.js';
import { Team } from '../teams/entities/team.entity.js';
import { CreateMatchStatsDTO } from './dto/create-match-stats.dto.js';
import type { MatchStatsResponseDTO } from './dto/match-stats-response.dto.js';
import type { UpdateMatchStatsDTO } from './dto/update-match-stats.dto.js';
import { MatchStats } from './entities/match-stats.entity.js';
import { mapMatchStatsResponse } from './match-stats-response.mapper.js';

// Conserva autoridad de negocio, referencias y unicidad dentro de una misma transacción.
@Injectable()
export class MatchStatsService {
  constructor(
    @InjectRepository(MatchStats) private readonly matchStatsRepository: Repository<MatchStats>,
    private readonly databaseWriteService: DatabaseWriteService,
  ) {}

  async findAll(): Promise<MatchStatsResponseDTO[]> {
    const matches = await this.matchStatsRepository.find({
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return matches.map(mapMatchStatsResponse);
  }

  async findOne(id: string): Promise<MatchStatsResponseDTO> {
    return mapMatchStatsResponse(await this.requireMatch(this.matchStatsRepository, id));
  }

  async create(
    dto: CreateMatchStatsDTO,
    actor: AuthenticatedUserInterface,
  ): Promise<MatchStatsResponseDTO> {
    return this.databaseWriteService
      .runAsAdministrator(actor, async (manager) => {
        const fields = await this.validateFields(dto);
        await this.ensureTeamsExist(manager, fields);
        const repository = manager.getRepository(MatchStats);
        await this.ensureUniqueMatch(repository, fields);
        return mapMatchStatsResponse(await repository.save(repository.create(fields)));
      })
      .catch((error: unknown) => {
        throw this.translateDatabaseError(error);
      });
  }

  async update(
    id: string,
    dto: UpdateMatchStatsDTO,
    actor: AuthenticatedUserInterface,
  ): Promise<MatchStatsResponseDTO> {
    if (
      [
        dto.date,
        dto.homeTeamId,
        dto.awayTeamId,
        dto.goalsHomeTeam,
        dto.goalsAwayTeam,
        dto.stadium,
        dto.attendance,
      ].every((value) => value === undefined)
    ) {
      throw new BadRequestException('Provide at least one editable match statistics field.');
    }
    return this.databaseWriteService
      .runAsAdministrator(actor, async (manager) => {
        const repository = manager.getRepository(MatchStats);
        const matchStats = await this.requireMatch(repository, id);
        // Valida el resultado completo: cambiar solo un equipo puede igualar ambas FK.
        const fields = await this.validateFields({
          date: dto.date === undefined ? matchStats.date : dto.date,
          homeTeamId: dto.homeTeamId === undefined ? matchStats.homeTeamId : dto.homeTeamId,
          awayTeamId: dto.awayTeamId === undefined ? matchStats.awayTeamId : dto.awayTeamId,
          goalsHomeTeam:
            dto.goalsHomeTeam === undefined ? matchStats.goalsHomeTeam : dto.goalsHomeTeam,
          goalsAwayTeam:
            dto.goalsAwayTeam === undefined ? matchStats.goalsAwayTeam : dto.goalsAwayTeam,
          stadium: dto.stadium === undefined ? matchStats.stadium : dto.stadium,
          attendance: dto.attendance === undefined ? matchStats.attendance : dto.attendance,
        });
        await this.ensureTeamsExist(manager, fields);
        await this.ensureUniqueMatch(repository, fields, id);
        Object.assign(matchStats, fields);
        return mapMatchStatsResponse(await repository.save(matchStats));
      })
      .catch((error: unknown) => {
        throw this.translateDatabaseError(error);
      });
  }

  async remove(id: string, actor: AuthenticatedUserInterface): Promise<void> {
    await this.databaseWriteService.runAsAdministrator(actor, async (manager) => {
      const repository = manager.getRepository(MatchStats);
      await repository.remove(await this.requireMatch(repository, id));
    });
  }

  private async requireMatch(repository: Repository<MatchStats>, id: string): Promise<MatchStats> {
    const matchStats = await repository.findOneBy({ id });
    if (matchStats === null) throw new NotFoundException('Match statistics not found.');
    return matchStats;
  }

  private async validateFields(fields: CreateMatchStatsDTO): Promise<CreateMatchStatsDTO> {
    const normalized = plainToInstance(CreateMatchStatsDTO, fields);
    const errors = await validate(normalized, {
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    });
    if (errors.length > 0)
      throw new BadRequestException(
        errors.flatMap((error) => Object.values(error.constraints ?? {})),
      );
    if (normalized.homeTeamId === normalized.awayTeamId) {
      throw new BadRequestException('Home and away teams must be different.');
    }
    return normalized;
  }

  private async ensureTeamsExist(
    manager: EntityManager,
    fields: CreateMatchStatsDTO,
  ): Promise<void> {
    const teams = manager.getRepository(Team);
    if (!(await teams.existsBy({ id: fields.homeTeamId })))
      throw new BadRequestException('Select an existing home team.');
    if (!(await teams.existsBy({ id: fields.awayTeamId })))
      throw new BadRequestException('Select an existing away team.');
  }

  private async ensureUniqueMatch(
    repository: Repository<MatchStats>,
    fields: CreateMatchStatsDTO,
    currentId?: string,
  ): Promise<void> {
    // El índice único usa esta misma terna; invertir local/visitante es otro partido.
    const existing = await repository.findOneBy({
      date: fields.date,
      homeTeamId: fields.homeTeamId,
      awayTeamId: fields.awayTeamId,
    });
    if (existing !== null && existing.id !== currentId) {
      throw new ConflictException(
        'Match statistics already exist for this date and pair of teams.',
      );
    }
  }

  private translateDatabaseError(error: unknown): unknown {
    // Las restricciones DB protegen también escrituras procedentes de otra conexión.
    const code = getSqliteErrorCode(error);
    if (code === 'SQLITE_CONSTRAINT_UNIQUE')
      return new ConflictException(
        'Match statistics already exist for this date and pair of teams.',
      );
    if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY')
      return new BadRequestException('Select existing home and away teams.');
    return error;
  }
}
