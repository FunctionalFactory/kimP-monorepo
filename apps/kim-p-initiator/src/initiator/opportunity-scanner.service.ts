import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { TradeExecutorService } from './trade-executor.service';
import { PriceUpdateData } from '../redis/redis-subscriber.service';
import { FeeCalculatorService, LoggingService } from '@app/kimp-core';

export interface ArbitrageOpportunity {
  symbol: string;
  upbitPrice: number;
  binancePrice: number;
  spreadPercent: number;
  isNormalOpportunity: boolean;
  netProfitPercent: number;
}

@Injectable()
export class OpportunityScannerService implements OnModuleInit {
  private readonly logger = new Logger(OpportunityScannerService.name);
  private lastPrices: Record<string, { upbit?: number; binance?: number }> = {};

  constructor(
    private readonly tradeExecutor: TradeExecutorService,
    private readonly eventEmitter: EventEmitter2,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly loggingService: LoggingService,
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
      // 스프레드 계산
      const opportunity = this.calculateSpread(symbol, upbit, binance);

      if (opportunity) {
        this.logger.log(
          `[기회감지] ${symbol} 스프레드: ${opportunity.spreadPercent.toFixed(2)}%, Normal: ${opportunity.isNormalOpportunity}`,
        );
        await this.tradeExecutor.initiateArbitrageCycle(opportunity);
      }
    }
  }

  private calculateSpread(
    symbol: string,
    upbitPrice: number,
    binancePrice: number,
  ): ArbitrageOpportunity | null {
    // 기본 스프레드 계산
    const spreadPercent =
      Math.abs((upbitPrice - binancePrice) / upbitPrice) * 100;

    // 0.5% 이상 스프레드가 있을 때만 기회로 판단
    if (spreadPercent < 0.5) {
      return null;
    }

    const isNormalOpportunity = upbitPrice > binancePrice;

    // 수수료 계산을 위한 기본 설정
    const rate = 1300; // USD/KRW 환율 (실제로는 동적으로 가져와야 함)
    const buyAmount = 1000000 / binancePrice; // 100만원 투자 시뮬레이션

    try {
      const feeResult = this.feeCalculatorService.calculate({
        symbol,
        amount: buyAmount,
        upbitPrice,
        binancePrice,
        rate,
        tradeDirection: isNormalOpportunity
          ? 'HIGH_PREMIUM_SELL_UPBIT'
          : 'LOW_PREMIUM_SELL_BINANCE',
      });

      return {
        symbol,
        upbitPrice,
        binancePrice,
        spreadPercent,
        isNormalOpportunity,
        netProfitPercent: feeResult.netProfitPercent,
      };
    } catch (error) {
      this.loggingService.error(
        `스프레드 계산 중 오류: ${error.message}`,
        error,
        { service: 'OpportunityScannerService' },
      );
      return null;
    }
  }
}
