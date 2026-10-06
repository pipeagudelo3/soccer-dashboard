import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';

import { MatchStats } from '../match-stats/entities/match-stats.entity.js';
import { Player } from '../players/entities/player.entity.js';
import { Team } from '../teams/entities/team.entity.js';
import { User } from '../users/entities/user.entity.js';
import { PasswordService } from '../users/password.service.js';
import { seedMatchStats, seedPlayers, seedTeams, seedUsers } from './seed-data.js';

// Devuelve únicamente cantidades; nunca incluye contraseñas, hashes ni perfiles.
export interface SeedCountInterface {
  created: number;
  skipped: number;
}

export interface SeedResultInterface {
  teams: SeedCountInterface;
  users: SeedCountInterface;
  players: SeedCountInterface;
  matchStats: SeedCountInterface;
}

// Se ejecuta solo desde el comando explícito; no utiliza hooks de inicio del servidor.
@Injectable()
export class SeedService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly passwordService: PasswordService,
  ) {}

  async run(): Promise<SeedResultInterface> {
    // Todo el lote es atómico: un fallo revierte los registros creados en esta ejecución.
    return this.dataSource.transaction(async (manager) => {
      const result: SeedResultInterface = {
        teams: { created: 0, skipped: 0 },
        users: { created: 0, skipped: 0 },
        players: { created: 0, skipped: 0 },
        matchStats: { created: 0, skipped: 0 },
      };

      const teamIds = await this.createTeams(manager, result.teams);
      await this.createUsers(manager, result.users);
      await this.createPlayers(manager, teamIds, result.players);
      await this.createMatchStats(manager, teamIds, result.matchStats);

      return result;
    });
  }

  private async createTeams(
    manager: EntityManager,
    counts: SeedCountInterface,
  ): Promise<Map<string, string>> {
    const repository = manager.getRepository(Team);
    const teamIds = new Map<string, string>();

    // Respeta entidades editadas por ID y equipos ya existentes con el mismo nombre.
    for (const fixture of seedTeams) {
      const existing =
        (await repository.findOneBy({ id: fixture.id })) ??
        (await repository.findOneBy({ name: fixture.name }));

      if (existing !== null) {
        teamIds.set(fixture.id, existing.id);
        counts.skipped += 1;
        continue;
      }

      const created = await repository.save(repository.create({ ...fixture }));
      teamIds.set(fixture.id, created.id);
      counts.created += 1;
    }

    return teamIds;
  }

  private async createUsers(manager: EntityManager, counts: SeedCountInterface): Promise<void> {
    const repository = manager.getRepository(User);

    for (const fixture of seedUsers) {
      // Nunca cambia rol, identidad ni password de una cuenta que ya existe.
      const existing = await repository.findOne({
        where: [{ id: fixture.id }, { email: fixture.email }],
      });

      if (existing !== null) {
        counts.skipped += 1;
        continue;
      }

      const { password, ...identity } = fixture;
      const passwordHash = await this.passwordService.hashPassword(password);
      await repository.save(repository.create({ ...identity, passwordHash }));
      counts.created += 1;
    }
  }

  private async createPlayers(
    manager: EntityManager,
    teamIds: Map<string, string>,
    counts: SeedCountInterface,
  ): Promise<void> {
    const repository = manager.getRepository(Player);

    for (const fixture of seedPlayers) {
      if (await repository.existsBy({ id: fixture.id })) {
        counts.skipped += 1;
        continue;
      }

      // Usa el ID real del equipo encontrado; null permanece una relación opcional.
      const teamId = fixture.teamId === null ? null : this.resolveTeamId(teamIds, fixture.teamId);
      await repository.save(repository.create({ ...fixture, teamId }));
      counts.created += 1;
    }
  }

  private async createMatchStats(
    manager: EntityManager,
    teamIds: Map<string, string>,
    counts: SeedCountInterface,
  ): Promise<void> {
    const repository = manager.getRepository(MatchStats);

    for (const fixture of seedMatchStats) {
      // La identidad estable preserva registros cuyo marcador o fecha fueron editados.
      if (await repository.existsBy({ id: fixture.id })) {
        counts.skipped += 1;
        continue;
      }

      const homeTeamId = this.resolveTeamId(teamIds, fixture.homeTeamId);
      const awayTeamId = this.resolveTeamId(teamIds, fixture.awayTeamId);
      const existingMatch = await repository.existsBy({
        date: fixture.date,
        homeTeamId,
        awayTeamId,
      });

      if (existingMatch) {
        counts.skipped += 1;
        continue;
      }

      await repository.save(repository.create({ ...fixture, homeTeamId, awayTeamId }));
      counts.created += 1;
    }
  }

  private resolveTeamId(teamIds: Map<string, string>, fixtureId: string): string {
    const resolvedId = teamIds.get(fixtureId);

    if (resolvedId === undefined) {
      throw new Error('Seed data references an unresolved team.');
    }

    return resolvedId;
  }
}
