import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from "typeorm";

/**
 * Referral entity representing referral transactions
 */
@Entity("referrals")
@Index(["signature"])
@Index(["refer"])
export class Referral {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  refer!: string;

  @Column({ type: "text" })
  signature!: string;

  @Column({ type: "text" })
  amount!: string;

  @Column({ type: "text", name: "input_asset" })
  inputAsset!: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

