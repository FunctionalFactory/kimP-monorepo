// packages/kimp-core/src/db/entities/trade.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ArbitrageCycle } from './arbitrage-cycle.entity';

export type TradeType =
  | 'HIGH_PREMIUM_BUY'
  | 'HIGH_PREMIUM_SELL'
  | 'LOW_PREMIUM_BUY'
  | 'LOW_PREMIUM_SELL';
export type TradeStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

@Entity('trades')
export class Trade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({
    type: 'uuid',
    name: 'cycle_id',
    comment: '연결된 차익거래 사이클 ID',
  })
  cycleId: string;

  @ManyToOne(() => ArbitrageCycle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cycle_id' })
  cycle: ArbitrageCycle;

  @Column({
    type: 'enum',
    enum: [
      'HIGH_PREMIUM_BUY',
      'HIGH_PREMIUM_SELL',
      'LOW_PREMIUM_BUY',
      'LOW_PREMIUM_SELL',
    ],
    name: 'trade_type',
    comment: '거래 유형',
  })
  tradeType: TradeType;

  @Column({
    type: 'varchar',
    length: 20,
    comment: '거래 심볼 (예: BTC, ETH)',
  })
  symbol: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'PENDING',
    comment: '거래 상태',
  })
  status: TradeStatus;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 4,
    nullable: true,
    name: 'net_profit_krw',
    comment: '순손익 (KRW)',
  })
  netProfitKrw: number;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 4,
    nullable: true,
    name: 'investment_krw',
    comment: '투자금액 (KRW)',
  })
  investmentKrw: number;

  @Column({
    type: 'json',
    nullable: true,
    comment: '거래 상세 정보 (JSON 형태)',
  })
  details: Record<string, any>;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'tx_id',
    comment: '거래소 거래 ID',
  })
  txId: string;

  @Column({
    type: 'text',
    nullable: true,
    name: 'error_message',
    comment: '오류 메시지',
  })
  errorMessage: string;
}
