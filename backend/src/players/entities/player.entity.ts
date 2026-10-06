import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import type { Relation } from 'typeorm';

import { BaseEntity } from '../../database/entities/base.entity.js';
import { Team } from '../../teams/entities/team.entity.js';

// Los CHECK evitan negativos, decimales y valores fuera del rango seguro de JSON.
@Entity('players')
@Index('IDX_players_team_id', ['teamId'])
@Check(
  'CHK_players_goals',
  `typeof("goals") = 'integer' AND "goals" BETWEEN 0 AND 9007199254740991`,
)
@Check(
  'CHK_players_assists',
  `typeof("assists") = 'integer' AND "assists" BETWEEN 0 AND 9007199254740991`,
)
@Check('CHK_players_status', `"status" IN ('active', 'injured', 'suspended', 'free-agent')`)
@Check('CHK_players_name', `length(trim("name")) > 0`)
@Check('CHK_players_position', `length(trim("position")) > 0`)
export class Player extends BaseEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  position!: string;

  @Column({ type: 'text' })
  status!: 'active' | 'injured' | 'suspended' | 'free-agent';

  // La columna FK nullable es la relación pública normalizada del frontend.
  @Column({ type: 'text', nullable: true })
  teamId!: string | null;

  @ManyToOne(() => Team, (team) => team.players, {
    nullable: true,
    onDelete: 'SET NULL',
    cascade: false,
  })
  @JoinColumn({ name: 'teamId' })
  team!: Relation<Team> | null;

  @Column({ type: 'integer' })
  goals!: number;

  @Column({ type: 'integer' })
  assists!: number;
}
