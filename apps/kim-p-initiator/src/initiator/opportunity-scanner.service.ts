import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { TradeExecutorService } from './trade-executor.service';
import { PriceUpdateData } from '../redis/redis-subscriber.service';

@Injectable()
export class OpportunityScannerService implements OnModuleInit {
  private readonly logger = new Logger(OpportunityScannerService.name);
  private lastPrices: Record<string, { upbit?: number; binance?: number }> = {};

  constructor(
    private readonly tradeExecutor: TradeExecutorService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    this.logger.log(
      'OpportunityScannerService initialized. Listening for price updates...',
    );
  }

  @OnEvent('price.update')
  async handlePriceUpdate(data: PriceUpdateData) {
    const { symbol, exchange, price } = data;
    if (!this.lastPrices[symbol]) this.lastPrices[symbol] = {};
    this.lastPrices[symbol][exchange] = price;
    const upbit = this.lastPrices[symbol].upbit;
    const binance = this.lastPrices[symbol].binance;
    if (upbit && binance) {
      // 간단한 스프레드 계산 (실제로는 더 복잡한 로직 필요)
      const spreadPercent = Math.abs((upbit - binance) / upbit) * 100;
      if (spreadPercent > 0.5) {
        // 0.5% 이상 스프레드가 있을 때 기회로 판단
        const isNormalOpportunity = upbit > binance;
        this.logger.log(
          `[기회감지] ${symbol} 스프레드: ${spreadPercent.toFixed(2)}%, Normal: ${isNormalOpportunity}`,
        );
        await this.tradeExecutor.initiateArbitrageCycle({
          symbol,
          upbit,
          binance,
          spread: {
            normalOpportunity: isNormalOpportunity,
            reverseOpportunity: !isNormalOpportunity,
          },
        });
      }
    }
  }
}
