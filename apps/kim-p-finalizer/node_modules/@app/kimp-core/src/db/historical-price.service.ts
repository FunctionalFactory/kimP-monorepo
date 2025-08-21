import { Injectable, Inject, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { HistoricalPrice } from './entities/historical-price.entity';
export interface ParsedPriceData {
  symbol: string;
  timestamp: Date;
  price: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
}

@Injectable()
export class HistoricalPriceService {
  private readonly logger = new Logger(HistoricalPriceService.name);

  constructor(
    @Inject('HISTORICAL_PRICE_REPOSITORY')
    private historicalPriceRepository: Repository<HistoricalPrice>,
  ) {}

  async saveHistoricalPrices(data: ParsedPriceData[]): Promise<void> {
    try {
      const entities = data.map((item) =>
        this.historicalPriceRepository.create({
          symbol: item.symbol,
          timestamp: item.timestamp,
          price: item.price,
          volume: item.volume,
          high: item.high,
          low: item.low,
          open: item.open,
          close: item.close,
        }),
      );

      await this.historicalPriceRepository.save(entities);
      this.logger.log(`${data.length}개의 과거 가격 데이터 저장 완료`);
    } catch (error) {
      this.logger.error(`과거 가격 데이터 저장 오류: ${error.message}`);
      throw error;
    }
  }

  async getAllHistoricalPrices(symbol?: string): Promise<HistoricalPrice[]> {
    const query = this.historicalPriceRepository.createQueryBuilder('price');

    if (symbol) {
      query.where('price.symbol = :symbol', { symbol });
    }

    return query.orderBy('price.timestamp', 'ASC').getMany();
  }

  async deleteHistoricalPrices(symbol?: string): Promise<void> {
    const query = this.historicalPriceRepository.createQueryBuilder().delete();

    if (symbol) {
      query.where('symbol = :symbol', { symbol });
    }

    await query.execute();
    this.logger.log(`${symbol ? symbol : '모든'} 과거 가격 데이터 삭제 완료`);
  }

  async getHistoricalPricesBySymbol(
    symbol: string,
  ): Promise<HistoricalPrice[]> {
    return this.historicalPriceRepository.find({
      where: { symbol },
      order: { timestamp: 'ASC' },
    });
  }

  async getDatasetInfo(): Promise<
    Array<{ symbol: string; count: number; uploadDate: string }>
  > {
    try {
      const result = await this.historicalPriceRepository
        .createQueryBuilder('price')
        .select('price.symbol', 'symbol')
        .addSelect('COUNT(*)', 'count')
        .addSelect('MAX(price.createdAt)', 'uploadDate')
        .groupBy('price.symbol')
        .getRawMany();

      return result.map((item) => ({
        symbol: item.symbol,
        count: parseInt(item.count),
        uploadDate: new Date(item.uploadDate).toISOString(),
      }));
    } catch (error) {
      this.logger.error(`데이터셋 정보 조회 오류: ${error.message}`);
      throw error;
    }
  }
}
