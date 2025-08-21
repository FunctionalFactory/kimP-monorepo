import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candlestick } from './entities/candlestick.entity';

@Injectable()
export class CandlestickService {
  constructor(
    @InjectRepository(Candlestick)
    private readonly candlestickRepository: Repository<Candlestick>,
  ) {}

  async create(candlestickData: Partial<Candlestick>): Promise<Candlestick> {
    const candlestick = this.candlestickRepository.create(candlestickData);
    return await this.candlestickRepository.save(candlestick);
  }

  async createMany(
    candlestickDataArray: Partial<Candlestick>[],
  ): Promise<Candlestick[]> {
    const candlesticks =
      this.candlestickRepository.create(candlestickDataArray);
    return await this.candlestickRepository.save(candlesticks);
  }

  async findByExchangeAndSymbol(
    exchange: string,
    symbol: string,
    timeframe: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Candlestick[]> {
    const query = this.candlestickRepository
      .createQueryBuilder('candlestick')
      .where('candlestick.exchange = :exchange', { exchange })
      .andWhere('candlestick.symbol = :symbol', { symbol })
      .andWhere('candlestick.timeframe = :timeframe', { timeframe })
      .orderBy('candlestick.timestamp', 'ASC');

    if (startDate) {
      query.andWhere('candlestick.timestamp >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('candlestick.timestamp <= :endDate', { endDate });
    }

    return await query.getMany();
  }

  async findLatestByExchangeAndSymbol(
    exchange: string,
    symbol: string,
    timeframe: string,
  ): Promise<Candlestick | null> {
    return await this.candlestickRepository.findOne({
      where: { exchange, symbol, timeframe },
      order: { timestamp: 'DESC' },
    });
  }

  async deleteByExchangeAndSymbol(
    exchange: string,
    symbol: string,
    timeframe: string,
  ): Promise<void> {
    await this.candlestickRepository.delete({ exchange, symbol, timeframe });
  }

  async getAvailableDatasets(): Promise<
    Array<{ exchange: string; symbol: string; timeframe: string }>
  > {
    const results = await this.candlestickRepository
      .createQueryBuilder('candlestick')
      .select([
        'candlestick.exchange',
        'candlestick.symbol',
        'candlestick.timeframe',
      ])
      .distinct()
      .getRawMany();

    return results.map((result) => ({
      exchange: result.candlestick_exchange,
      symbol: result.candlestick_symbol,
      timeframe: result.candlestick_timeframe,
    }));
  }
}
