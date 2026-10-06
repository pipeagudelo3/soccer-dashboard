import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';

import { BaseEntity } from '../../database/entities/base.entity.js';
import { Team } from '../../teams/entities/team.entity.js';

// La combinación de fecha, local y visitante identifica un registro no duplicado.
@Entity('match_stats')
@Index('UQ_match_stats_date_teams', ['date', 'homeTeamId', 'awayTeamId'], { unique: true })
@Index('IDX_match_stats_home_team_id', ['homeTeamId'])
@Index('IDX_match_stats_away_team_id', ['awayTeamId'])
@Check('CHK_match_stats_different_teams', `"homeTeamId" <> "awayTeamId"`)
@Check(
  'CHK_match_stats_home_goals',
  `typeof("goalsHomeTeam") = 'integer' AND "goalsHomeTeam" BETWEEN 0 AND 9007199254740991`,
)
@Check(
  'CHK_match_stats_away_goals',
  `typeof("goalsAwayTeam") = 'integer' AND "goalsAwayTeam" BETWEEN 0 AND 9007199254740991`,
)
@Check(
  'CHK_match_stats_attendance',
  `typeof("attendance") = 'integer' AND "attendance" BETWEEN 0 AND 9007199254740991`,
)
@Check('CHK_match_stats_stadium', `length(trim("stadium")) > 0`)
export class MatchStats extends BaseEntity {
  @Column({ type: 'date' })
  date!: string;

  // Ambas referencias son obligatorias; RESTRICT conserva partidos registrados.
  @Column({ type: 'text' })
  homeTeamId!: string;

  @ManyToOne(() => Team, (team) => team.homeMatches, {
    nullable: false,
    onDelete: 'RESTRICT',
    cascade: false,
  })
  @JoinColumn({ name: 'homeTeamId' })
  homeTeam!: Relation<Team>;

  @Column({ type: 'text' })
  awayTeamId!: string;

  @ManyToOne(() => Team, (team) => team.awayMatches, {
    nullable: false,
    onDelete: 'RESTRICT',
    cascade: false,
  })
  @JoinColumn({ name: 'awayTeamId' })
  awayTeam!: Relation<Team>;

  @Column({ type: 'integer' })
  goalsHomeTeam!: number;

  @Column({ type: 'integer' })
  goalsAwayTeam!: number;

  @Column({ type: 'text' })
  stadium!: string;

  @Column({ type: 'integer' })
  attendance!: number;
}
