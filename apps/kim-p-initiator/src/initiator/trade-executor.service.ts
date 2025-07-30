import { Injectable, Logger } from '@nestjs/common';
import { ArbitrageOpportunity } from './opportunity-scanner.service';
import {
  ArbitrageRecordService,
  PortfolioManagerService,
  LoggingService,
  ErrorHandlerService,
  DistributedLockService,
} from '@app/kimp-core';

@Injectable()
export class TradeExecutorService {
  private readonly logger = new Logger(TradeExecutorService.name);

  constructor(
    private readonly arbitrageRecordService: ArbitrageRecordService,
    private readonly portfolioManagerService: PortfolioManagerService,
    private readonly loggingService: LoggingService,
    private readonly errorHandlerService: ErrorHandlerService,
    private readonly distributedLockService: DistributedLockService,
  ) {}

  async initiateArbitrageCycle(opportunity: ArbitrageOpportunity) {
    // 분산 잠금 키 생성
    const lockKey = `lock:${opportunity.symbol}`;
    const lockTTL = 30000; // 30초 잠금

    // 분산 잠금 획득 시도
    const lockAcquired = await this.distributedLockService.acquireLock(
      lockKey,
      lockTTL,
    );
    if (!lockAcquired) {
      this.logger.warn(
        `[${opportunity.symbol}] 중복 처리 방지: 이미 처리 중인 기회입니다`,
      );
      return;
    }

    try {
      // 1단계: 자금 확인
      const investmentAmount =
        await this.portfolioManagerService.getCurrentInvestmentAmount();
      if (investmentAmount <= 0) {
        this.logger.warn(
          `[${opportunity.symbol}] 투자 가능 자금이 부족합니다: ${investmentAmount.toLocaleString()} KRW`,
        );
        return;
      }

      this.logger.log(
        `[${opportunity.symbol}] 자금 확인 완료 - 투자 가능 금액: ${investmentAmount.toLocaleString()} KRW`,
      );

      // 2단계: 사이클 및 거래 기록 생성
      const arbitrageCycle =
        await this.arbitrageRecordService.createArbitrageCycle({
          initialInvestmentKrw: investmentAmount,
          totalNetProfitPercent: opportunity.netProfitPercent,
          status: 'AWAITING_REBALANCE', // cursor.md 요구사항에 따라 설정
        });

      const cycleId = arbitrageCycle.id;

      // 3단계: 초기 'PROFIT' 거래 기록 생성
      const tradeType = opportunity.isNormalOpportunity
        ? 'HIGH_PREMIUM_BUY'
        : 'LOW_PREMIUM_BUY';

      const initialTrade = await this.arbitrageRecordService.createTrade({
        cycleId,
        tradeType,
        symbol: opportunity.symbol,
        status: 'COMPLETED', // cursor.md 요구사항에 따라 설정
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
        `[${opportunity.symbol}] 새로운 차익거래 사이클 시작: ${cycleId}, 초기 거래: ${initialTrade.id}`,
      );

      // 4단계: LoggingService.run으로 사이클 ID를 포함한 로그 컨텍스트 설정
      await LoggingService.run({ cycleId }, async () => {
        this.loggingService.info(`차익거래 사이클 시작됨`, {
          service: 'TradeExecutorService',
          cycleId,
          symbol: opportunity.symbol,
        });

        // 5단계: 전략 실행 (시뮬레이션)
        try {
          if (opportunity.isNormalOpportunity) {
            this.logger.log(
              `[${opportunity.symbol}] HIGH_PREMIUM 전략 실행 시뮬레이션`,
            );
            // 실제로는 this.strategyHighService.handleHighPremiumFlow() 호출
          } else {
            this.logger.log(
              `[${opportunity.symbol}] LOW_PREMIUM 전략 실행 시뮬레이션`,
            );
            // 실제로는 this.strategyLowService.handleLowPremiumFlow() 호출
          }

          this.logger.log(`[${opportunity.symbol}] 전략 실행 완료`);
        } catch (strategyError) {
          this.logger.error(
            `[${opportunity.symbol}] 전략 실행 실패: ${strategyError.message}`,
          );

          // 6단계: 전략 실패 시 ErrorHandlerService 사용 및 사이클 상태를 FAILED로 업데이트
          await this.errorHandlerService.handleError({
            error: strategyError,
            severity: 'HIGH' as any,
            category: 'BUSINESS_LOGIC' as any,
            context: {
              cycleId,
              symbol: opportunity.symbol,
              stage: 'STRATEGY_EXECUTION' as any,
            },
          });

          // 사이클 상태를 FAILED로 업데이트
          await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
            status: 'FAILED',
            errorDetails: `전략 실행 실패: ${strategyError.message}`,
          });
        }
      });
    } catch (err) {
      this.logger.error(
        `[${opportunity.symbol}] 차익거래 사이클 시작 실패: ${err.message}`,
      );
      this.loggingService.error(`차익거래 사이클 시작 중 오류 발생`, err, {
        service: 'TradeExecutorService',
        symbol: opportunity.symbol,
      });
    } finally {
      // 분산 잠금 해제 (성공/실패 관계없이 항상 실행)
      await this.distributedLockService.releaseLock(lockKey);
      this.logger.debug(`[${opportunity.symbol}] 분산 잠금 해제: ${lockKey}`);
    }
  }
}
