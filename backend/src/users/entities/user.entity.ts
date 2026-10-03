import { BeforeInsert, BeforeUpdate, Check, Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../database/entities/base.entity.js';
import type { UserResponseDTO } from '../dto/user-response.dto.js';

// La unicidad NOCASE protege emails incluso ante inserciones concurrentes.
// El CHECK acepta la forma de un hash bcrypt, nunca una contraseña en texto plano.
@Entity('users')
@Index('UQ_users_email', ['email'], { unique: true })
@Check('CHK_users_role', `"role" IN ('admin', 'user')`)
@Check('CHK_users_name', `length(trim("name")) > 0`)
@Check('CHK_users_email', `length(trim("email")) > 0`)
@Check(
  'CHK_users_password_hash',
  `length("passwordHash") = 60 AND "passwordHash" GLOB '$2[ab]$[0-9][0-9]$*' AND CAST(substr("passwordHash", 5, 2) AS INTEGER) BETWEEN 10 AND 31`,
)
export class User extends BaseEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', collation: 'NOCASE' })
  email!: string;

  @Column({ type: 'text', default: 'user' })
  role!: 'admin' | 'user';

  // Las lecturas ordinarias del repositorio no seleccionan este campo.
  @Column({ type: 'text', select: false })
  passwordHash!: string;

  // Normaliza campos al guardar mediante entidades; no modifica el hash recibido.
  @BeforeInsert()
  @BeforeUpdate()
  normalizeIdentity(): void {
    this.name = this.name.trim();
    this.email = this.email.trim().toLowerCase();
  }

  // Incluso una entidad cargada explícitamente con su hash se serializa sin él.
  toJSON(): UserResponseDTO {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
