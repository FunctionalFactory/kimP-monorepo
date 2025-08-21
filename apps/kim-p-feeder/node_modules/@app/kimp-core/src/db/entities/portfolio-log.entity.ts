// src/db/entities/portfolio-log.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ArbitrageCycle } from './arbitrage-cycle.entity';

@Entity('portfolio_logs')
export class PortfolioLog {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 2,
    comment: '총 KRW 환산 잔고',
  })
  total_balance_krw: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 2,
    comment: '사이클 순손익금 (KRW)',
    default: 0,
  })
  cycle_pnl_krw: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 2,
    comment: '총 순손익금 (KRW)',
    default: 0,
  })
  total_pnl_krw: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 4,
    comment: 'ROI 퍼센트',
    default: 0,
  })
  roi_percentage: number;

  @Column({
    type: 'enum',
    enum: ['INITIAL', 'TRADE', 'FINAL'],
    comment: '로그 타입',
  })
  log_type: 'INITIAL' | 'TRADE' | 'FINAL';

  @ManyToOne(() => ArbitrageCycle, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cycle_id' })
  cycle: ArbitrageCycle | null;

  @Column({
    type: 'int',
    nullable: true,
    comment: '연결된 차익거래 사이클 ID',
  })
  cycle_id: number | null;
}
