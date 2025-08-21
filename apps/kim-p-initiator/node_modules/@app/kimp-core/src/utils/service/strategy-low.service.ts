import { Injectable, Logger } from '@nestjs/common';
import { ExchangeService } from '../../exchange/exchange.service';
import { LoggingService } from '../handler/logging.service';
import { ErrorHandlerService } from '../handler/error-handler.service';

export interface LowPremiumFlowParams {
  symbol: string;
  investmentAmount: number;
  upbitPrice: number;
  binancePrice: number;
  cycleId: string;
}

@Injectable()
export class StrategyLowService {
  private readonly logger = new Logger(StrategyLowService.name);

  constructor(
    private readonly exchangeService: ExchangeService,
    private readonly loggingService: LoggingService,
    private readonly errorHandlerService: ErrorHandlerService,
  ) {}

  async handleLowPremiumFlow(params: LowPremiumFlowParams): Promise<boolean> {
    const { symbol, investmentAmount, upbitPrice, binancePrice, cycleId } =
      params;

    try {
      this.logger.log(`[${symbol}] LOW_PREMIUM 전략 실행 시작`);

      // 1단계: 업비트에서 코인 매수 (시뮬레이션)
      const buyAmount = investmentAmount / upbitPrice;
      this.logger.log(
        `[${symbol}] 업비트 매수 시뮬레이션: ${buyAmount} ${symbol} @ ${upbitPrice} KRW`,
      );

      this.loggingService.info(`업비트 매수 완료`, {
        service: 'StrategyLowService',
        cycleId,
        symbol,
      });

      // 2단계: 업비트에서 바이낸스로 코인 전송 (시뮬레이션)
      this.logger.log(`[${symbol}] 코인 전송 시뮬레이션: 업비트 → 바이낸스`);

      this.loggingService.info(`코인 전송 완료`, {
        service: 'StrategyLowService',
        cycleId,
        symbol,
      });

      // 3단계: 바이낸스에서 코인 매도 (시뮬레이션)
      this.logger.log(
        `[${symbol}] 바이낸스 매도 시뮬레이션: ${buyAmount} ${symbol} @ ${binancePrice} USDT`,
      );

      this.loggingService.info(`바이낸스 매도 완료`, {
        service: 'StrategyLowService',
        cycleId,
        symbol,
      });

      this.logger.log(`[${symbol}] LOW_PREMIUM 전략 실행 완료`);
      return true;
    } catch (error) {
      this.logger.error(
        `[${symbol}] LOW_PREMIUM 전략 실행 실패: ${error.message}`,
      );

      await this.errorHandlerService.handleError({
        error,
        severity: 'HIGH' as any,
        category: 'BUSINESS_LOGIC' as any,
        context: {
          cycleId,
          symbol,
          stage: 'LOW_PREMIUM' as any,
        },
      });

      return false;
    }
  }
}
