import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { TradeExecutorService } from './trade-executor.service';
import { PriceUpdateData } from '../redis/redis-subscriber.service';
import {
  FeeCalculatorService,
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
    private readonly feeCalculatorService: FeeCalculatorService,
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
      // 스프레드 계산
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
    // 1단계: 기본 스프레드 계산
    const spreadPercent =
      Math.abs((upbitPrice - binancePrice) / upbitPrice) * 100;

    // 설정에서 최소 스프레드 가져오기
    const config = this.investmentConfigService.getInvestmentConfig();
    if (spreadPercent < config.minSpreadPercent) {
      this.logger.debug(
        `[필터링] ${symbol} 스프레드 부족: ${spreadPercent.toFixed(2)}% < ${config.minSpreadPercent}%`,
      );
      return null;
    }

    const isNormalOpportunity = upbitPrice > binancePrice;

    // 2단계: 동적 설정값 가져오기
    const rate = config.exchangeRateUsdtKrw; // 설정에서 환율 가져오기
    const investmentAmount =
      await this.portfolioManagerService.getCurrentInvestmentAmount();
    const buyAmount = investmentAmount / binancePrice; // 실제 투자 가능 금액 사용

    try {
      // 3단계: FeeCalculatorService를 통한 3단계 필터링 (수수료, 거래량, 슬리피지)
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

      // 수익성 필터링 (순수익이 양수여야 함)
      if (feeResult.netProfitPercent <= 0) {
        this.logger.debug(
          `[필터링] ${symbol} 수익성 부족: ${feeResult.netProfitPercent.toFixed(2)}%`,
        );
        return null;
      }

      this.logger.log(
        `[기회감지] ${symbol} 수익성 확인: ${feeResult.netProfitPercent.toFixed(2)}%`,
      );

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
