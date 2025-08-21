import { Injectable, Logger } from '@nestjs/common';
import { ArbitrageRecordService, BacktestSessionService } from '@app/kimp-core';

export interface BacktestKPI {
  totalProfitLoss: number;
  totalTrades: number;
  winCount: number;
  winRate: number;
  averageProfitLoss: number;
  initialCapital: number;
  totalRoi: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export interface TradeDetail {
  id: string;
  startTime: Date;
  endTime: Date;
  status: string;
  initialInvestmentKrw: number;
  totalNetProfitKrw: number;
  totalNetProfitPercent: number;
  profitLoss: number;
  roi: number;
}

export interface BacktestResult {
  sessionId: string;
  sessionInfo: {
    id: string;
    status: string;
    createdAt: Date;
    startTime: Date;
    endTime: Date;
    parameters: any;
  };
  kpi: BacktestKPI;
  trades: TradeDetail[];
  cumulativeProfit: Array<{
    timestamp: Date;
    cumulativeProfit: number;
  }>;
}

@Injectable()
export class BacktestResultService {
  private readonly logger = new Logger(BacktestResultService.name);

  constructor(
    private readonly arbitrageRecordService: ArbitrageRecordService,
    private readonly backtestSessionService: BacktestSessionService,
  ) {}

  async analyze(sessionId: string): Promise<BacktestResult> {
    try {
      this.logger.log(`백테스팅 결과 분석 시작: ${sessionId}`);

      // 1. 세션 정보 조회
      const session = await this.backtestSessionService.findById(sessionId);
      if (!session) {
        throw new Error(`백테스팅 세션을 찾을 수 없습니다: ${sessionId}`);
      }

      // 2. 해당 세션의 모든 ArbitrageCycle 조회
      const cycles = await this.getArbitrageCyclesBySession(sessionId);

      // 3. KPI 계산
      const kpi = this.calculateKPI(cycles, session.parameters.totalCapital);

      // 4. 거래 상세 정보 변환
      const trades = this.convertToTradeDetails(cycles);

      // 5. 누적 수익 계산
      const cumulativeProfit = this.calculateCumulativeProfit(trades);

      const result: BacktestResult = {
        sessionId,
        sessionInfo: {
          id: session.id,
          status: session.status,
          createdAt: session.createdAt,
          startTime: session.startTime,
          endTime: session.endTime,
          parameters: session.parameters,
        },
        kpi,
        trades,
        cumulativeProfit,
      };

      this.logger.log(`백테스팅 결과 분석 완료: ${sessionId}`);
      return result;
    } catch (error) {
      this.logger.error(
        `백테스팅 결과 분석 오류: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async getArbitrageCyclesBySession(sessionId: string): Promise<any[]> {
    // TODO: ArbitrageCycle에 sessionId 필드가 없으므로,
    // 현재는 모든 완료된 사이클을 반환합니다.
    // 실제 구현에서는 sessionId로 필터링해야 합니다.

    // 임시로 모든 완료된 사이클을 반환
    const cycles = await this.arbitrageRecordService.getAllCompletedCycles();
    return cycles || [];
  }

  private calculateKPI(cycles: any[], initialCapital: number): BacktestKPI {
    if (cycles.length === 0) {
      return {
        totalProfitLoss: 0,
        totalTrades: 0,
        winCount: 0,
        winRate: 0,
        averageProfitLoss: 0,
        initialCapital,
        totalRoi: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
      };
    }

    const totalProfitLoss = cycles.reduce((sum, cycle) => {
      return sum + (cycle.totalNetProfitKrw || 0);
    }, 0);

    const totalTrades = cycles.length;
    const winCount = cycles.filter(
      (cycle) => (cycle.totalNetProfitKrw || 0) > 0,
    ).length;
    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
    const averageProfitLoss =
      totalTrades > 0 ? totalProfitLoss / totalTrades : 0;
    const totalRoi =
      initialCapital > 0 ? (totalProfitLoss / initialCapital) * 100 : 0;

    // 최대 낙폭 계산
    const maxDrawdown = this.calculateMaxDrawdown(cycles, initialCapital);

    // 샤프 비율 계산
    const sharpeRatio = this.calculateSharpeRatio(cycles);

    return {
      totalProfitLoss,
      totalTrades,
      winCount,
      winRate,
      averageProfitLoss,
      initialCapital,
      totalRoi,
      maxDrawdown,
      sharpeRatio,
    };
  }

  private convertToTradeDetails(cycles: any[]): TradeDetail[] {
    return cycles.map((cycle) => ({
      id: cycle.id,
      startTime: cycle.startTime,
      endTime: cycle.endTime,
      status: cycle.status,
      initialInvestmentKrw: cycle.initialInvestmentKrw || 0,
      totalNetProfitKrw: cycle.totalNetProfitKrw || 0,
      totalNetProfitPercent: cycle.totalNetProfitPercent || 0,
      profitLoss: cycle.totalNetProfitKrw || 0,
      roi: cycle.totalNetProfitPercent || 0,
    }));
  }

  private calculateCumulativeProfit(
    trades: TradeDetail[],
  ): Array<{ timestamp: Date; cumulativeProfit: number }> {
    const sortedTrades = trades.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );

    let cumulativeProfit = 0;
    return sortedTrades.map((trade) => {
      cumulativeProfit += trade.profitLoss;
      return {
        timestamp: trade.startTime,
        cumulativeProfit,
      };
    });
  }

  private calculateMaxDrawdown(cycles: any[], initialCapital: number): number {
    let peak = initialCapital;
    let maxDrawdown = 0;
    let currentValue = initialCapital;

    const sortedCycles = cycles.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );

    for (const cycle of sortedCycles) {
      currentValue += cycle.totalNetProfitKrw || 0;

      if (currentValue > peak) {
        peak = currentValue;
      }

      const drawdown = ((peak - currentValue) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  private calculateSharpeRatio(cycles: any[]): number {
    if (cycles.length < 2) return 0;

    const returns = cycles.map((cycle) => cycle.totalNetProfitPercent || 0);
    const meanReturn =
      returns.reduce((sum, ret) => sum + ret, 0) / returns.length;

    const variance =
      returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) /
      returns.length;
    const standardDeviation = Math.sqrt(variance);

    // 무위험 수익률을 0%로 가정
    const riskFreeRate = 0;

    return standardDeviation > 0
      ? (meanReturn - riskFreeRate) / standardDeviation
      : 0;
  }
}
