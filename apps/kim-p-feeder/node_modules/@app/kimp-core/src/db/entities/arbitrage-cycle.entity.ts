// packages/kimp-core/src/db/entities/arbitrage-cycle.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Trade } from './trade.entity';

export type ArbitrageCycleStatus =
  | 'STARTED'
  | 'INITIAL_TRADE_COMPLETED'
  | 'AWAITING_REBALANCE'
  | 'REBALANCING_IN_PROGRESS'
  | 'REBALANCE_TRADE_COMPLETED'
  | 'COMPLETED'
  | 'FAILED'
  | 'AWAITING_RETRY'
  | 'DEAD_LETTER';

@Entity('arbitrage_cycles')
export class ArbitrageCycle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'start_time' })
  startTime: Date;

  @UpdateDateColumn({ name: 'end_time', nullable: true })
  endTime: Date;

  @Column({
    type: 'enum',
    enum: [
      'STARTED',
      'INITIAL_TRADE_COMPLETED',
      'AWAITING_REBALANCE',
      'REBALANCING_IN_PROGRESS',
      'REBALANCE_TRADE_COMPLETED',
      'COMPLETED',
      'FAILED',
      'AWAITING_RETRY',
      'DEAD_LETTER',
    ],
    default: 'STARTED',
    comment: '사이클 상태',
  })
  status: ArbitrageCycleStatus;

  @Column({
    type: 'uuid',
    nullable: true,
    name: 'initial_trade_id',
    comment: '초기 거래 ID (FK to Trade)',
  })
  initialTradeId: string;

  @Column({
    type: 'uuid',
    nullable: true,
    name: 'rebalance_trade_id',
    comment: '재조정 거래 ID (FK to Trade)',
  })
  rebalanceTradeId: string;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 4,
    nullable: true,
    name: 'total_net_profit_krw',
    comment: '총 순손익 (KRW)',
  })
  totalNetProfitKrw: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
    name: 'total_net_profit_percent',
    comment: '총 순손익률 (%)',
  })
  totalNetProfitPercent: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 4,
    nullable: true,
    name: 'initial_investment_krw',
    comment: '초기 투자금 (KRW)',
  })
  initialInvestmentKrw: number;

  @Column({
    type: 'text',
    nullable: true,
    name: 'error_details',
    comment: '오류 상세 정보',
  })
  errorDetails: string;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'locked_at',
    comment: '잠금 획득 시간 (타임아웃 체크용)',
  })
  lockedAt: Date;

  @Column({
    type: 'int',
    default: 0,
    name: 'retry_count',
    comment: '재시도 횟수',
  })
  retryCount: number;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'last_retry_at',
    comment: '마지막 재시도 시간',
  })
  lastRetryAt: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'next_retry_at',
    comment: '다음 재시도 예정 시간',
  })
  nextRetryAt: Date;

  @Column({
    type: 'text',
    nullable: true,
    name: 'failure_reason',
    comment: '실패 사유',
  })
  failureReason: string;

  // 관계 설정
  @OneToMany(() => Trade, (trade) => trade.cycle)
  trades: Trade[];
}
