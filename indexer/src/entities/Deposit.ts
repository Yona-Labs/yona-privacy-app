import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from "typeorm";

/**
 * Deposit entity representing first deposits by users
 */
@Entity("deposits")
@Index(["user"], { unique: true })
@Index(["commitmentIndex"])
export class Deposit {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text", unique: true })
  user!: string;

  @Column({ type: "integer", name: "commitment_index" })
  commitmentIndex!: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

