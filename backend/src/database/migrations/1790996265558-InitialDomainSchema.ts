import type { MigrationInterface, QueryRunner } from 'typeorm';

import { playerTimestampTrigger } from '../player-timestamp-trigger.js';

// Crea el esquema inicial en una base vacía sin activar synchronize en producción.
export class InitialDomainSchema1790996265558 implements MigrationInterface {
  name = 'InitialDomainSchema1790996265558';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Crea users con sus columnas, CHECK y referencias del modelo canónico.
    await queryRunner.query(
      `CREATE TABLE "users" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" text NOT NULL, "email" text COLLATE NOCASE NOT NULL, "role" text NOT NULL DEFAULT ('user'), "passwordHash" text NOT NULL, CONSTRAINT "CHK_users_password_hash" CHECK (length("passwordHash") = 60 AND "passwordHash" GLOB '$2[ab]$[0-9][0-9]$*' AND CAST(substr("passwordHash", 5, 2) AS INTEGER) BETWEEN 10 AND 31), CONSTRAINT "CHK_users_email" CHECK (length(trim("email")) > 0), CONSTRAINT "CHK_users_name" CHECK (length(trim("name")) > 0), CONSTRAINT "CHK_users_role" CHECK ("role" IN ('admin', 'user')))`,
    );

    // Crea teams con sus columnas, CHECK y referencias del modelo canónico.
    await queryRunner.query(
      `CREATE TABLE "teams" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" text COLLATE NOCASE NOT NULL, "logoURL" text NOT NULL, "country" text NOT NULL, "stadium" text NOT NULL, "foundedDate" date NOT NULL, CONSTRAINT "CHK_teams_stadium" CHECK (length(trim("stadium")) > 0), CONSTRAINT "CHK_teams_country" CHECK (length(trim("country")) > 0), CONSTRAINT "CHK_teams_name" CHECK (length(trim("name")) > 0))`,
    );

    // Crea players con sus columnas, CHECK y referencias del modelo canónico.
    await queryRunner.query(
      `CREATE TABLE "players" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" text NOT NULL, "position" text NOT NULL, "status" text NOT NULL, "teamId" varchar, "goals" integer NOT NULL, "assists" integer NOT NULL, CONSTRAINT "CHK_players_position" CHECK (length(trim("position")) > 0), CONSTRAINT "CHK_players_name" CHECK (length(trim("name")) > 0), CONSTRAINT "CHK_players_status" CHECK ("status" IN ('active', 'injured', 'suspended', 'free-agent')), CONSTRAINT "CHK_players_assists" CHECK (typeof("assists") = 'integer' AND "assists" BETWEEN 0 AND 9007199254740991), CONSTRAINT "CHK_players_goals" CHECK (typeof("goals") = 'integer' AND "goals" BETWEEN 0 AND 9007199254740991), CONSTRAINT "FK_ecaf0c4aabc76f1a3d1a91ea33c" FOREIGN KEY ("teamId") REFERENCES "teams" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`,
    );

    // Crea match_stats con sus columnas, CHECK y referencias del modelo canónico.
    await queryRunner.query(
      `CREATE TABLE "match_stats" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "date" date NOT NULL, "homeTeamId" varchar NOT NULL, "awayTeamId" varchar NOT NULL, "goalsHomeTeam" integer NOT NULL, "goalsAwayTeam" integer NOT NULL, "stadium" text NOT NULL, "attendance" integer NOT NULL, CONSTRAINT "CHK_match_stats_stadium" CHECK (length(trim("stadium")) > 0), CONSTRAINT "CHK_match_stats_attendance" CHECK (typeof("attendance") = 'integer' AND "attendance" BETWEEN 0 AND 9007199254740991), CONSTRAINT "CHK_match_stats_away_goals" CHECK (typeof("goalsAwayTeam") = 'integer' AND "goalsAwayTeam" BETWEEN 0 AND 9007199254740991), CONSTRAINT "CHK_match_stats_home_goals" CHECK (typeof("goalsHomeTeam") = 'integer' AND "goalsHomeTeam" BETWEEN 0 AND 9007199254740991), CONSTRAINT "CHK_match_stats_different_teams" CHECK ("homeTeamId" <> "awayTeamId"), CONSTRAINT "FK_ae090737e5cf3fd0ddab74e7d5d" FOREIGN KEY ("homeTeamId") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION, CONSTRAINT "FK_e20156506fca80b21b8a93d95ad" FOREIGN KEY ("awayTeamId") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`,
    );

    // Índices únicos y de relación protegen integridad y consultas por equipo.
    await queryRunner.query(`CREATE INDEX "IDX_players_team_id" ON "players" ("teamId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_teams_name" ON "teams" ("name")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_match_stats_away_team_id" ON "match_stats" ("awayTeamId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_match_stats_home_team_id" ON "match_stats" ("homeTeamId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_match_stats_date_teams" ON "match_stats" ("date", "homeTeamId", "awayTeamId")`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_users_email" ON "users" ("email")`);

    // Mantiene updatedAt cuando SQLite desvincula un jugador por SET NULL.
    await queryRunner.query(playerTimestampTrigger);
  }

  // Revertir esta migración elimina el esquema y sus datos; solo con respaldo/revisión.
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "TRG_players_team_updated_at"`);
    await queryRunner.query(`DROP TABLE "match_stats"`);
    await queryRunner.query(`DROP TABLE "players"`);
    await queryRunner.query(`DROP TABLE "teams"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
