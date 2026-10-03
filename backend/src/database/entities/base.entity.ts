import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Comparte UUID y timestamps entre las cuatro entidades, sin crear una tabla adicional.
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // TypeORM usa Date internamente; JSON/DTOs publican fechas ISO UTC.
  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}
