import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BacktestSessionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('backtest_sessions')
export class BacktestSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: BacktestSessionStatus,
    default: BacktestSessionStatus.PENDING,
  })
  status: BacktestSessionStatus;

  @Column({ type: 'json' })
  parameters: {
    minSpread: number;
    maxLoss: number;
    investmentAmount: number;
    upbitSymbol: string;
    binanceSymbol: string;
    timeframe: string;
    startDate: string;
    endDate: string;
  };

  @Column({ type: 'json', nullable: true })
  results: {
    totalTrades: number;
    successfulTrades: number;
    totalProfit: number;
    totalLoss: number;
    netProfit: number;
    winRate: number;
    maxDrawdown: number;
    sharpeRatio: number;
    trades: Array<{
      timestamp: string;
      symbol: string;
      action: string;
      price: number;
      amount: number;
      profit: number;
    }>;
  };

  @Column({ type: 'timestamp', nullable: true })
  startTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  endTime: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
