import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from "typeorm";

/**
 * CommitmentEvent entity representing a commitment event from the Solana program
 */
@Entity("commitment_events")
@Index(["commitment"], { unique: true })
@Index(["index"])
@Index(["signature"])
@Index(["slot"])
export class CommitmentEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  commitment!: string;

  @Column({ type: "integer" })
  index!: number;

  @Column({ type: "bigint" })
  slot!: number | string;

  @Column({ type: "text" })
  signature!: string;

  @Column({ type: "text", name: "encrypted_output" })
  encryptedOutput!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
