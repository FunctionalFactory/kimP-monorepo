import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('candlesticks')
@Index(['exchange', 'symbol', 'timeframe', 'timestamp'], { unique: true })
export class Candlestick {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  exchange: string;

  @Column({ length: 20 })
  symbol: string;

  @Column({ length: 10 })
  timeframe: string; // '1m', '5m', '15m', '1h', '4h', '1d'

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  open: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  high: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  low: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  close: number;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  volume: number;

  @CreateDateColumn()
  createdAt: Date;
}
