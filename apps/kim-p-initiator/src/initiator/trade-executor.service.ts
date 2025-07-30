import { Injectable, Logger } from '@nestjs/common';
import { ArbitrageOpportunity } from './opportunity-scanner.service';
import {
  ArbitrageRecordService,
  PortfolioManagerService,
  LoggingService,
} from '@app/kimp-core';

@Injectable()
export class TradeExecutorService {
  private readonly logger = new Logger(TradeExecutorService.name);

  constructor(
    private readonly arbitrageRecordService: ArbitrageRecordService,
    private readonly portfolioManagerService: PortfolioManagerService,
    private readonly loggingService: LoggingService,
  ) {}

  async initiateArbitrageCycle(opportunity: ArbitrageOpportunity) {
    try {
      // 1. 자금 확인
      const investmentAmount =
        await this.portfolioManagerService.getCurrentInvestmentAmount();

      if (investmentAmount <= 0) {
        this.logger.warn(
          `[${opportunity.symbol}] 투자 가능 금액이 없습니다: ${investmentAmount.toLocaleString()} KRW`,
        );
        return;
      }

      this.logger.log(
        `[${opportunity.symbol}] 투자 가능 금액: ${investmentAmount.toLocaleString()} KRW`,
      );

      // 2. 사이클 생성
      const arbitrageCycle =
        await this.arbitrageRecordService.createArbitrageCycle({
          initialInvestmentKrw: investmentAmount,
          totalNetProfitPercent: opportunity.netProfitPercent,
        });

      const cycleId = arbitrageCycle.id;

      // 3. 초기 거래 기록 생성
      const tradeType = opportunity.isNormalOpportunity
        ? 'HIGH_PREMIUM_BUY'
        : 'LOW_PREMIUM_BUY';

      await this.arbitrageRecordService.createTrade({
        cycleId,
        tradeType,
        symbol: opportunity.symbol,
        investmentKrw: investmentAmount,
        netProfitKrw: (investmentAmount * opportunity.netProfitPercent) / 100,
        details: {
          upbitPrice: opportunity.upbitPrice,
          binancePrice: opportunity.binancePrice,
          spreadPercent: opportunity.spreadPercent,
          marketDirection: opportunity.isNormalOpportunity
            ? 'NORMAL'
            : 'REVERSE',
          netProfitPercent: opportunity.netProfitPercent,
        },
      });

      this.logger.log(
        `[${opportunity.symbol}] 새로운 차익거래 사이클 시작: ${cycleId}`,
      );

      // 4. 전략 실행 시뮬레이션
      if (opportunity.isNormalOpportunity) {
        this.logger.log(`[${opportunity.symbol}] Normal 전략 실행`);
      } else {
        this.logger.log(`[${opportunity.symbol}] Reverse 전략 실행`);
      }

      // 5. 로깅 서비스 호출
      LoggingService.run({ cycleId }, () => {
        this.loggingService.info(`차익거래 사이클 시작됨`, {
          service: 'TradeExecutorService',
          cycleId,
          symbol: opportunity.symbol,
        });
      });
    } catch (err) {
      this.logger.error(`트레이드 실패: ${err.message}`);
      this.loggingService.error(`트레이드 실행 중 오류 발생`, err, {
        service: 'TradeExecutorService',
        symbol: opportunity.symbol,
      });
    }
  }
}
