import { Injectable, Logger } from '@nestjs/common';
import { ExchangeService } from '../../exchange/exchange.service';
import { LoggingService } from '../handler/logging.service';
import { ErrorHandlerService } from '../handler/error-handler.service';

export interface HighPremiumFlowParams {
  symbol: string;
  investmentAmount: number;
  upbitPrice: number;
  binancePrice: number;
  cycleId: string;
}

@Injectable()
export class StrategyHighService {
  private readonly logger = new Logger(StrategyHighService.name);

  constructor(
    private readonly exchangeService: ExchangeService,
    private readonly loggingService: LoggingService,
    private readonly errorHandlerService: ErrorHandlerService,
  ) {}

  async handleHighPremiumFlow(params: HighPremiumFlowParams): Promise<boolean> {
    const { symbol, investmentAmount, upbitPrice, binancePrice, cycleId } =
      params;

    try {
      this.logger.log(`[${symbol}] HIGH_PREMIUM 전략 실행 시작`);

      // 1단계: 바이낸스에서 코인 매수 (시뮬레이션)
      const buyAmount = investmentAmount / binancePrice;
      this.logger.log(
        `[${symbol}] 바이낸스 매수 시뮬레이션: ${buyAmount} ${symbol} @ ${binancePrice} USDT`,
      );

      this.loggingService.info(`바이낸스 매수 완료`, {
        service: 'StrategyHighService',
        cycleId,
        symbol,
      });

      // 2단계: 바이낸스에서 업비트로 코인 전송 (시뮬레이션)
      this.logger.log(`[${symbol}] 코인 전송 시뮬레이션: 바이낸스 → 업비트`);

      this.loggingService.info(`코인 전송 완료`, {
        service: 'StrategyHighService',
        cycleId,
        symbol,
      });

      // 3단계: 업비트에서 코인 매도 (시뮬레이션)
      this.logger.log(
        `[${symbol}] 업비트 매도 시뮬레이션: ${buyAmount} ${symbol} @ ${upbitPrice} KRW`,
      );

      this.loggingService.info(`업비트 매도 완료`, {
        service: 'StrategyHighService',
        cycleId,
        symbol,
      });

      this.logger.log(`[${symbol}] HIGH_PREMIUM 전략 실행 완료`);
      return true;
    } catch (error) {
      this.logger.error(
        `[${symbol}] HIGH_PREMIUM 전략 실행 실패: ${error.message}`,
      );

      await this.errorHandlerService.handleError({
        error,
        severity: 'HIGH' as any,
        category: 'BUSINESS_LOGIC' as any,
        context: {
          cycleId,
          symbol,
          stage: 'HIGH_PREMIUM' as any,
        },
      });

      return false;
    }
  }
}
