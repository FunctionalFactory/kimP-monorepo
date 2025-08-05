import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { TradeExecutorService } from './trade-executor.service';
import { PriceUpdateData } from '../redis/redis-subscriber.service';
import {
  SpreadCalculatorService,
  LoggingService,
  InvestmentConfigService,
  PortfolioManagerService,
  ExchangeService,
  BacktestSessionService,
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
    private readonly backtestSessionService: BacktestSessionService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.logger.log(
      'OpportunityScannerService initialized. Listening for price updates...',
    );
  }

  @OnEvent('price.update')
  async handlePriceUpdate(data: PriceUpdateData) {
    const { symbol, exchange, price, sessionId } = data;

    // 백테스트 모드에서 세션 ID가 있는 경우 세션별 파라미터 사용
    let sessionParameters = null;
    if (sessionId) {
      try {
        const session = await this.backtestSessionService.findById(sessionId);
        if (session && session.status === 'RUNNING') {
          sessionParameters = session.parameters;
        }
      } catch (error) {
        this.logger.error(`세션 파라미터 조회 오류: ${error.message}`);
      }
    }

    if (!this.lastPrices[symbol]) this.lastPrices[symbol] = {};
    this.lastPrices[symbol][exchange] = price;

    const upbit = this.lastPrices[symbol].upbit;
    const binance = this.lastPrices[symbol].binance;

    if (upbit && binance) {
      // SpreadCalculatorService를 사용한 3단계 필터링
      const opportunity = await this.calculateSpread(
        symbol,
        upbit,
        binance,
        sessionParameters,
      );

      if (opportunity) {
        this.logger.log(
          `[기회감지] ${symbol} 스프레드: ${opportunity.spreadPercent.toFixed(2)}%, Normal: ${opportunity.isNormalOpportunity}`,
        );
        await this.tradeExecutor.initiateArbitrageCycle(opportunity, sessionId);
      }
    }
  }

  private async calculateSpread(
    symbol: string,
    upbitPrice: number,
    binancePrice: number,
    sessionParameters?: any,
  ): Promise<ArbitrageOpportunity | null> {
    try {
      // 세션 파라미터가 있으면 사용, 없으면 기본값 사용
      let investmentAmount: number;
      let minSpread: number;

      if (sessionParameters) {
        investmentAmount = sessionParameters.investmentAmount;
        minSpread = sessionParameters.minSpread;
      } else {
        // 기본값 사용
        investmentAmount =
          await this.portfolioManagerService.getCurrentInvestmentAmount();
        minSpread = await this.investmentConfigService.getMinSpread();
      }

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
        minSpread, // 세션 파라미터에서 가져온 최소 스프레드 사용
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
