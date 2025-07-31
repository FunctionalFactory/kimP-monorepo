import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { TradeExecutorService } from './trade-executor.service';
import { PriceUpdateData } from '../redis/redis-subscriber.service';
import {
  SpreadCalculatorService,
  LoggingService,
  InvestmentConfigService,
  PortfolioManagerService,
  ExchangeService,
} from '@app/kimp-core';

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
    private readonly spreadCalculatorService: SpreadCalculatorService,
    private readonly loggingService: LoggingService,
    private readonly investmentConfigService: InvestmentConfigService,
    private readonly portfolioManagerService: PortfolioManagerService,
    private readonly exchangeService: ExchangeService,
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
      // SpreadCalculatorService를 사용한 3단계 필터링
      const opportunity = await this.calculateSpread(symbol, upbit, binance);

      if (opportunity) {
        this.logger.log(
          `[기회감지] ${symbol} 스프레드: ${opportunity.spreadPercent.toFixed(2)}%, Normal: ${opportunity.isNormalOpportunity}`,
        );
        await this.tradeExecutor.initiateArbitrageCycle(opportunity);
      }
    }
  }

  private async calculateSpread(
    symbol: string,
    upbitPrice: number,
    binancePrice: number,
  ): Promise<ArbitrageOpportunity | null> {
    try {
      // 투자 가능 금액 가져오기
      const investmentAmount =
        await this.portfolioManagerService.getCurrentInvestmentAmount();

      if (investmentAmount <= 0) {
        this.logger.debug(`[${symbol}] 투자 가능 금액이 없습니다`);
        return null;
      }

      // SpreadCalculatorService를 통한 3단계 필터링 (수수료, 거래량, 슬리피지)
      const spreadResult = await this.spreadCalculatorService.calculateSpread({
        symbol,
        upbitPrice,
        binancePrice,
        investmentAmount,
      });

      if (!spreadResult) {
        return null;
      }

      return {
        symbol: spreadResult.symbol,
        upbitPrice: spreadResult.upbitPrice,
        binancePrice: spreadResult.binancePrice,
        spreadPercent: spreadResult.spreadPercent,
        isNormalOpportunity: spreadResult.isNormalOpportunity,
        netProfitPercent: spreadResult.netProfitPercent,
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
