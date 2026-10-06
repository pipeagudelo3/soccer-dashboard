import { BeforeInsert, BeforeUpdate, Check, Column, Entity, Index, OneToMany } from 'typeorm';
import type { Relation } from 'typeorm';

import { BaseEntity } from '../../database/entities/base.entity.js';
import { MatchStats } from '../../match-stats/entities/match-stats.entity.js';
import { Player } from '../../players/entities/player.entity.js';

// Registra el equipo y protege su nombre único sin distinguir mayúsculas ASCII.
@Entity('teams')
@Index('UQ_teams_name', ['name'], { unique: true })
@Check('CHK_teams_name', `length(trim("name")) > 0`)
@Check('CHK_teams_country', `length(trim("country")) > 0`)
@Check('CHK_teams_stadium', `length(trim("stadium")) > 0`)
export class Team extends BaseEntity {
  @Column({ type: 'text', collation: 'NOCASE' })
  name!: string;

  @Column({ type: 'text' })
  logoURL!: string;

  @Column({ type: 'text' })
  country!: string;

  @Column({ type: 'text' })
  stadium!: string;

  @Column({ type: 'date' })
  foundedDate!: string;

  // Son relaciones de navegación ORM; no añaden arrays al contrato REST público.
  @OneToMany(() => Player, (player) => player.team)
  players!: Relation<Player[]>;

  @OneToMany(() => MatchStats, (matchStats) => matchStats.homeTeam)
  homeMatches!: Relation<MatchStats[]>;

  @OneToMany(() => MatchStats, (matchStats) => matchStats.awayTeam)
  awayMatches!: Relation<MatchStats[]>;

  // Mantiene coherencia con los services actuales al guardar una entidad.
  @BeforeInsert()
  @BeforeUpdate()
  normalizeFields(): void {
    this.name = this.name.trim();
    this.logoURL = this.logoURL.trim();
    this.country = this.country.trim();
    this.stadium = this.stadium.trim();
    this.foundedDate = this.foundedDate.trim();
  }
}
