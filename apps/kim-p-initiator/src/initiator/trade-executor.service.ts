import { Injectable, Logger } from '@nestjs/common';
import {
  ArbitrageRecordService,
  LoggingService,
  ExchangeService,
  InvestmentConfigService,
  ArbitrageCycle,
} from '@app/kimp-core';

@Injectable()
export class TradeExecutorService {
  private readonly logger = new Logger(TradeExecutorService.name);

  constructor(
    private readonly arbitrageRecordService: ArbitrageRecordService,
    private readonly exchangeService: ExchangeService,
    private readonly investmentConfigService: InvestmentConfigService,
  ) {}

  /**
   * 새로운 차익거래 사이클을 생성하고 실행합니다.
   */
  async executeNewArbitrageCycle(
    symbol: string,
    investmentAmount: number,
  ): Promise<ArbitrageCycle> {
    // 새로운 사이클 생성
    const newCycle = await this.arbitrageRecordService.createArbitrageCycle({
      initialInvestmentKrw: investmentAmount,
    });

    // LoggingService.run을 사용하여 컨텍스트 설정
    return LoggingService.run({ cycleId: newCycle.id }, async () => {
      this.logger.log(
        `Starting new arbitrage cycle for ${symbol} with investment: ${investmentAmount} KRW`,
      );

      try {
        // 거래 실행 로직
        await this.executeInitialTrade(newCycle, symbol, investmentAmount);

        // 사이클 상태를 INITIAL_TRADE_COMPLETED로 업데이트
        await this.arbitrageRecordService.updateArbitrageCycle(newCycle.id, {
          status: 'INITIAL_TRADE_COMPLETED',
        });

        this.logger.log(
          `Initial trade completed successfully for cycle ${newCycle.id}`,
        );

        // 사이클을 AWAITING_REBALANCE 상태로 변경
        await this.arbitrageRecordService.updateArbitrageCycle(newCycle.id, {
          status: 'AWAITING_REBALANCE',
        });

        this.logger.log(
          `Cycle ${newCycle.id} moved to AWAITING_REBALANCE status`,
        );

        return await this.arbitrageRecordService.getArbitrageCycle(newCycle.id);
      } catch (error) {
        this.logger.error(
          `Failed to execute arbitrage cycle ${newCycle.id}: ${error.message}`,
          error.stack,
        );

        // 사이클을 FAILED 상태로 변경
        await this.arbitrageRecordService.updateArbitrageCycle(newCycle.id, {
          status: 'FAILED',
          errorDetails: error.message,
        });

        throw error;
      }
    });
  }

  /**
   * 초기 거래를 실행합니다.
   */
  private async executeInitialTrade(
    cycle: ArbitrageCycle,
    symbol: string,
    amount: number,
  ): Promise<void> {
    this.logger.log(
      `Executing initial trade for cycle ${cycle.id} - ${symbol}: ${amount} KRW`,
    );

    // 거래소별 가격 조회 (시뮬레이션)
    // 실제 구현에서는 getTickerInfo를 사용하여 실제 가격을 조회합니다
    const upbitPrice = 1000 + Math.random() * 100; // 시뮬레이션 가격
    const binancePrice = 1000 + Math.random() * 100; // 시뮬레이션 가격

    this.logger.log(
      `Price comparison - Upbit: ${upbitPrice}, Binance: ${binancePrice}`,
    );

    // 차익거래 로직 (간단한 예시)
    if (upbitPrice > binancePrice) {
      // Upbit에서 매수, Binance에서 매도
      this.logger.log(
        `Arbitrage opportunity detected: Buy on Binance, Sell on Upbit`,
      );

      // 실제 거래 실행 (시뮬레이션)
      await this.simulateTrade(
        'BINANCE',
        'BUY',
        symbol,
        amount / binancePrice,
        binancePrice,
      );
      await this.simulateTrade(
        'UPBIT',
        'SELL',
        symbol,
        amount / binancePrice,
        upbitPrice,
      );
    } else {
      // Binance에서 매수, Upbit에서 매도
      this.logger.log(
        `Arbitrage opportunity detected: Buy on Upbit, Sell on Binance`,
      );

      // 실제 거래 실행 (시뮬레이션)
      await this.simulateTrade(
        'UPBIT',
        'BUY',
        symbol,
        amount / upbitPrice,
        upbitPrice,
      );
      await this.simulateTrade(
        'BINANCE',
        'SELL',
        symbol,
        amount / upbitPrice,
        binancePrice,
      );
    }

    this.logger.log(`Initial trade execution completed for cycle ${cycle.id}`);
  }

  /**
   * 거래를 시뮬레이션합니다 (실제 구현에서는 실제 거래 API 호출).
   */
  private async simulateTrade(
    exchange: 'UPBIT' | 'BINANCE',
    action: 'BUY' | 'SELL',
    symbol: string,
    quantity: number,
    price: number,
  ): Promise<void> {
    this.logger.log(
      `Simulating ${action} ${quantity} ${symbol} @ ${price} on ${exchange}`,
    );

    // 실제 구현에서는 여기서 거래소 API를 호출합니다
    await new Promise((resolve) => setTimeout(resolve, 100)); // 시뮬레이션 지연

    this.logger.log(`Simulated ${action} completed on ${exchange}`);
  }
}
