import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('historical_prices')
@Index(['symbol', 'timestamp'])
export class HistoricalPrice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20 })
  symbol: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  price: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  volume: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  high: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  low: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  open: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  close: number;

  @CreateDateColumn()
  createdAt: Date;
}
