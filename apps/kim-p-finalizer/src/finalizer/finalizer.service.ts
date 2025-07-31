import { Injectable, Logger } from '@nestjs/common';
import { ArbitrageRecordService } from '@app/kimp-core';
import { RetryManagerService } from '@app/kimp-core';
import { PortfolioLogService } from '@app/kimp-core';
import { SpreadCalculatorService } from '@app/kimp-core';
import { StrategyHighService } from '@app/kimp-core';
import { StrategyLowService } from '@app/kimp-core';
import { ArbitrageCycle } from '@app/kimp-core';

@Injectable()
export class FinalizerService {
  private readonly logger = new Logger(FinalizerService.name);

  constructor(
    private readonly arbitrageRecordService: ArbitrageRecordService,
    private readonly retryManagerService: RetryManagerService,
    private readonly portfolioLogService: PortfolioLogService,
    private readonly spreadCalculatorService: SpreadCalculatorService,
    private readonly strategyHighService: StrategyHighService,
    private readonly strategyLowService: StrategyLowService,
  ) {}

  async processPendingCycles(): Promise<void> {
    this.logger.debug('🔄 대기 중인 차익거래 사이클 처리 시작');

    try {
      // 1. 다음 대기 중인 사이클을 찾아서 잠금 처리
      const cycle = await this.arbitrageRecordService.findAndLockNextCycle();

      if (!cycle) {
        this.logger.debug('대기 중인 사이클이 없습니다.');
        return;
      }

      this.logger.log(`📋 사이클 발견: ${cycle.id} (상태: ${cycle.status})`);

      // 2. 사이클 처리
      await this.processCycle(cycle);

      this.logger.log(`✅ 사이클 처리 완료: ${cycle.id}`);
    } catch (error) {
      this.logger.error(`❌ 사이클 처리 중 오류 발생: ${error.message}`);
    }
  }

  private async processCycle(cycle: ArbitrageCycle): Promise<void> {
    this.logger.log(`🔄 사이클 처리 시작: ${cycle.id} (상태: ${cycle.status})`);

    try {
      // 1. 사이클과 관련 거래 정보 조회
      const cycleWithTrades =
        await this.arbitrageRecordService.getCycleWithTrades(cycle.id);
      if (!cycleWithTrades) {
        throw new Error(`사이클 정보를 찾을 수 없습니다: ${cycle.id}`);
      }

      // 2. 재균형 거래 계획 수립
      const rebalancePlan = await this.planRebalanceTrade(cycleWithTrades);

      if (!rebalancePlan) {
        this.logger.warn(
          `수익성 있는 재균형 옵션을 찾을 수 없습니다: ${cycle.id}`,
        );
        return;
      }

      // 3. 재균형 거래 실행
      const rebalanceResult = await this.executeRebalanceTrade(
        cycleWithTrades,
        rebalancePlan,
      );

      // 4. 성공 처리
      if (rebalanceResult.success) {
        await this.handleRebalanceSuccess(cycleWithTrades, rebalanceResult);
      } else {
        throw new Error(`재균형 거래 실패: ${rebalanceResult.error}`);
      }
    } catch (error) {
      this.logger.error(`❌ 사이클 ${cycle.id} 처리 실패: ${error.message}`);

      // 5. 실패 처리 - 재시도 매니저에 위임
      await this.retryManagerService.handleCycleFailure(cycle, error);
    }
  }

  private async planRebalanceTrade(cycle: ArbitrageCycle): Promise<any> {
    // 실제 구현에서는 현재 시장 가격을 조회하여 재균형 계획을 수립
    // 여기서는 기본적인 구조만 제공
    const symbol = 'BTC'; // 실제로는 사이클에서 추출
    const investmentAmount = cycle.initialInvestmentKrw || 1000000;

    // 현재 시장 가격 조회 (실제 구현에서는 ExchangeService 사용)
    const marketState = this.spreadCalculatorService.getMarketState(symbol);

    if (!marketState) {
      return null;
    }

    // 스프레드 계산
    const spreadResult = await this.spreadCalculatorService.calculateSpread({
      symbol,
      upbitPrice: marketState.upbitPrice || 50000000,
      binancePrice: marketState.binancePrice || 49000000,
      investmentAmount,
    });

    return spreadResult;
  }

  private async executeRebalanceTrade(
    cycle: ArbitrageCycle,
    rebalancePlan: any,
  ): Promise<any> {
    this.logger.log(`🔄 재균형 거래 실행 시작: ${cycle.id}`);

    try {
      const symbol = 'BTC'; // 실제로는 사이클에서 추출
      const investmentAmount = cycle.initialInvestmentKrw || 1000000;

      let tradeResult = false;

      // 전략에 따라 적절한 서비스 호출
      if (rebalancePlan.isNormalOpportunity) {
        // HIGH_PREMIUM 전략
        tradeResult = await this.strategyHighService.handleHighPremiumFlow({
          symbol,
          investmentAmount,
          upbitPrice: rebalancePlan.upbitPrice,
          binancePrice: rebalancePlan.binancePrice,
          cycleId: cycle.id,
        });
      } else {
        // LOW_PREMIUM 전략
        tradeResult = await this.strategyLowService.handleLowPremiumFlow({
          symbol,
          investmentAmount,
          upbitPrice: rebalancePlan.upbitPrice,
          binancePrice: rebalancePlan.binancePrice,
          cycleId: cycle.id,
        });
      }

      if (!tradeResult) {
        return { success: false, error: '전략 실행 실패' };
      }

      // 재균형 거래 기록 생성
      const rebalanceTrade = await this.arbitrageRecordService.createTrade({
        cycleId: cycle.id,
        tradeType: rebalancePlan.isNormalOpportunity
          ? 'HIGH_PREMIUM_SELL'
          : 'LOW_PREMIUM_SELL',
        status: 'COMPLETED',
        symbol,
        investmentKrw: investmentAmount,
        netProfitKrw: (rebalancePlan.netProfitPercent * investmentAmount) / 100,
        details: {
          upbitPrice: rebalancePlan.upbitPrice,
          binancePrice: rebalancePlan.binancePrice,
          totalFee: rebalancePlan.totalFee,
        },
      });

      const totalProfit =
        (rebalancePlan.netProfitPercent * investmentAmount) / 100;
      const finalBalance = investmentAmount + totalProfit;

      return {
        success: true,
        tradeId: rebalanceTrade.id,
        totalProfit,
        finalBalance,
      };
    } catch (error) {
      this.logger.error(`❌ 재균형 거래 실행 실패: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  private async handleRebalanceSuccess(
    cycle: ArbitrageCycle,
    rebalanceResult: any,
  ): Promise<void> {
    this.logger.log(
      `✅ 재균형 거래 성공 - 거래 ID: ${rebalanceResult.tradeId}`,
    );

    // 1. 사이클 상태를 COMPLETED로 업데이트
    await this.arbitrageRecordService.updateArbitrageCycle(cycle.id, {
      status: 'COMPLETED',
      rebalanceTradeId: rebalanceResult.tradeId,
      totalNetProfitKrw: rebalanceResult.totalProfit,
      totalNetProfitPercent:
        (rebalanceResult.totalProfit / cycle.initialInvestmentKrw) * 100,
      endTime: new Date(),
    });

    // 2. 포트폴리오 로그 기록
    await this.portfolioLogService.createLog({
      timestamp: new Date(),
      upbit_balance_krw: rebalanceResult.finalBalance * 0.5, // 예시
      binance_balance_krw: rebalanceResult.finalBalance * 0.5, // 예시
      total_balance_krw: rebalanceResult.finalBalance,
      cycle_pnl_krw: rebalanceResult.totalProfit,
      cycle_pnl_rate_percent:
        (rebalanceResult.totalProfit / cycle.initialInvestmentKrw) * 100,
      linked_arbitrage_cycle_id: cycle.id,
      remarks: `재균형 거래 완료: ${rebalanceResult.tradeId}`,
    });

    this.logger.log(
      `🎉 사이클 ${cycle.id} 완료 - 총 수익: ${rebalanceResult.totalProfit}`,
    );
  }
}
