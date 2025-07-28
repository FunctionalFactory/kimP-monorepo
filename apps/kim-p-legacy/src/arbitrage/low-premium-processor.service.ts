// src/arbitrage/low-premium-processor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ArbitrageCycleStateService,
  CycleExecutionStatus,
} from './arbitrage-cycle-state.service';
import {
  PriceFeedService,
  WatchedSymbolConfig,
} from '../marketdata/price-feed.service';
import { ArbitrageRecordService } from '../db/arbitrage-record.service';
import { StrategyLowService } from '../common/strategy-low.service';
import { FeeCalculatorService } from '../common/fee-calculator.service';
import { ExchangeService } from '../common/exchange.service';
import { ArbitrageCycle } from '../db/entities/arbitrage-cycle.entity';
import { SlippageCalculatorService } from 'src/common/slippage-calculator.service';
import { ISession } from '../session/interfaces/session.interface';

export interface LowPremiumResult {
  success: boolean;
  cycleId: string;
  finalStatus?: ArbitrageCycle | null;
  error?: Error;
}

interface LowPremiumOpportunity {
  symbol: string;
  upbitPrice: number;
  binancePrice: number;
  expectedNetProfitKrw: number;
  expectedNetProfitRatePercent: number;
  expectedLossKrw: number; // 🔥 추가
  expectedLossPercent: number; // 🔥 추가
  rate: number;
}

@Injectable()
export class LowPremiumProcessorService {
  private readonly logger = new Logger(LowPremiumProcessorService.name);

  private readonly watchedSymbols: ReadonlyArray<WatchedSymbolConfig>;
  private readonly MAX_SEARCH_DURATION_MS: number;
  private readonly MINIMUM_VOLUME_KRW = 5000000000; // 최소 거래대금 100억 원

  constructor(
    private readonly configService: ConfigService,
    private readonly cycleStateService: ArbitrageCycleStateService,
    private readonly priceFeedService: PriceFeedService,
    private readonly arbitrageRecordService: ArbitrageRecordService,
    private readonly strategyLowService: StrategyLowService,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly exchangeService: ExchangeService,
    private readonly slippageCalculatorService: SlippageCalculatorService, // ⭐️ 주입 추가
  ) {
    this.logger.verbose(
      `[초기화] LowPremiumProcessorService 초기화 완료. 최소 거래대금 기준: ${(this.MINIMUM_VOLUME_KRW / 100000000).toFixed(2)}억 KRW`,
    );

    this.MAX_SEARCH_DURATION_MS =
      this.configService.get<number>('LOW_PREMIUM_MAX_SEARCH_DURATION_MS') ||
      60000 * 60; // 1 hour

    this.watchedSymbols = this.priceFeedService.getWatchedSymbols();
    if (!this.watchedSymbols || this.watchedSymbols.length === 0) {
      this.logger.warn(
        'Watched symbols are not configured in LowPremiumProcessorService via PriceFeedService.',
      );
      this.watchedSymbols = [];
    }
  }

  private parseAndValidateNumber(value: any): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  public async processLowPremiumOpportunity(): Promise<LowPremiumResult | null> {
    if (
      this.cycleStateService.currentCycleExecutionStatus !==
        CycleExecutionStatus.AWAITING_LOW_PREMIUM ||
      !this.cycleStateService.activeCycleId ||
      this.cycleStateService.requiredLowPremiumNetProfitKrwForActiveCycle ===
        null
    ) {
      return null;
    }

    const activeCycleId = this.cycleStateService.activeCycleId!;
    // const requiredProfitKrw =
    //   this.cycleStateService.requiredLowPremiumNetProfitKrwForActiveCycle!;

    const cycleInfoForLowPremium =
      await this.arbitrageRecordService.getArbitrageCycle(activeCycleId);
    const actualHighPremiumNetProfitKrw = this.parseAndValidateNumber(
      cycleInfoForLowPremium?.highPremiumNetProfitKrw,
    );
    const highPremiumSymbol = cycleInfoForLowPremium?.highPremiumSymbol;
    // const highPremiumInitialRate = this.parseAndValidateNumber(
    //   cycleInfoForLowPremium?.highPremiumInitialRate,
    // );

    if (
      !cycleInfoForLowPremium ||
      cycleInfoForLowPremium.initialInvestmentKrw === null
    ) {
      this.logger.error(
        `🔴 [LPP] 사이클(${activeCycleId})의 초기 투자금 정보를 찾을 수 없습니다.`,
      );
      await this.arbitrageRecordService.updateArbitrageCycle(activeCycleId, {
        status: 'FAILED',
        errorDetails: '저프 투자금 정보 없음(LPP)',
        endTime: new Date(),
      });
      return {
        success: false,
        cycleId: activeCycleId,
        finalStatus:
          await this.arbitrageRecordService.getArbitrageCycle(activeCycleId),
        error: new Error('Initial investment info not found for low premium.'),
      };
    }

    let lowPremiumInvestmentKRW =
      this.cycleStateService.getLowPremiumInvestment();

    if (lowPremiumInvestmentKRW === null) {
      // 사이클 상태에 없으면 기존 방식으로 계산
      const baseInvestmentKRW = this.parseAndValidateNumber(
        cycleInfoForLowPremium.initialInvestmentKrw,
      )!;
      const highPremiumProfitKRW = actualHighPremiumNetProfitKrw || 0;
      lowPremiumInvestmentKRW = baseInvestmentKRW + highPremiumProfitKRW;

      this.logger.verbose(
        `[LPP_INVESTMENT] 사이클 상태에서 투자금을 찾을 수 없어 계산: ${baseInvestmentKRW.toFixed(0)} KRW (원금) + ${highPremiumProfitKRW.toFixed(0)} KRW (고프리미엄 수익) = ${lowPremiumInvestmentKRW.toFixed(0)} KRW`,
      );
    } else {
      this.logger.verbose(
        `[LPP_INVESTMENT] 사이클 상태에서 투자금 가져옴: ${lowPremiumInvestmentKRW.toFixed(0)} KRW`,
      );
    }

    const searchStartTime = this.cycleStateService.lowPremiumSearchStartTime;
    if (!searchStartTime) {
      this.logger.error(
        `[LPP] Low premium search start time not set for cycle ${activeCycleId}.`,
      );
      await this.arbitrageRecordService.updateArbitrageCycle(activeCycleId, {
        status: 'FAILED',
        errorDetails: '저프 탐색 시작 시간 없음(LPP)',
        endTime: new Date(),
      });
      return {
        success: false,
        cycleId: activeCycleId,
        finalStatus:
          await this.arbitrageRecordService.getArbitrageCycle(activeCycleId),
        error: new Error('Search start time not set'),
      };
    }

    const allowedLossKrw = this.cycleStateService.getAllowedLowPremiumLoss();
    if (allowedLossKrw === null) {
      this.logger.error(
        `[LPP] 허용 가능한 저프리미엄 손실 정보가 설정되지 않았습니다.`,
      );
      return null;
    }

    // �� 추가: 저프리미엄 탐색 시작 로그
    this.logger.verbose(
      `[LPP_SEARCH_START] 저프리미엄 기회 탐색을 시작합니다.`,
    );
    this.logger.verbose(
      ` - 고프리미엄 코인: ${highPremiumSymbol?.toUpperCase() || 'N/A'}`,
    );
    this.logger.verbose(
      ` - 고프리미엄 수익: ${actualHighPremiumNetProfitKrw?.toFixed(0) || 'N/A'} KRW`,
    );
    this.logger.verbose(
      ` - 고프리미엄 수익률: ${actualHighPremiumNetProfitKrw && lowPremiumInvestmentKRW > 0 ? ((actualHighPremiumNetProfitKrw / lowPremiumInvestmentKRW) * 100).toFixed(2) : 'N/A'}%`,
    );
    this.logger.verbose(
      ` - 허용 가능한 손실: ${allowedLossKrw.toFixed(0)} KRW`,
    );
    this.logger.verbose(` - 투자금: ${lowPremiumInvestmentKRW.toFixed(0)} KRW`);
    this.logger.verbose(
      ` - 탐색 대상 코인 수: ${this.watchedSymbols.length}개`,
    );

    let candidateCount = 0; // 🔥 추가: 후보 코인 카운트
    let bestLowPremiumOpportunity: LowPremiumOpportunity | null = null; // 🔥 타입 변경

    const currentRateForLowPremium = this.exchangeService.getUSDTtoKRW();
    const highPremiumSymbolForCurrentCycle =
      cycleInfoForLowPremium?.highPremiumSymbol;

    this.logger.verbose(
      `[LPP_SEARCH] 허용 가능한 저프리미엄 손실: ${allowedLossKrw.toFixed(0)} KRW`,
    );

    for (const watched of this.watchedSymbols) {
      if (
        highPremiumSymbolForCurrentCycle &&
        watched.symbol === highPremiumSymbolForCurrentCycle
      )
        continue;

      const upbitPrice = this.priceFeedService.getUpbitPrice(watched.symbol);
      const binancePrice = this.priceFeedService.getBinancePrice(
        watched.symbol,
      );

      if (upbitPrice && binancePrice && lowPremiumInvestmentKRW > 0) {
        this.logger.verbose(
          `[LPP_ANALYSIS] ${watched.symbol.toUpperCase()} 분석 중...`,
        );

        // 유동성 필터링 로직을 이 곳에 적용합니다.
        try {
          const upbitVolume24h = this.priceFeedService.getUpbitVolume(
            watched.symbol,
          );

          if (upbitVolume24h < this.MINIMUM_VOLUME_KRW) {
            this.logger.verbose(
              `[LP_FILTERED] Skipped ${watched.symbol} due to low trading volume: ${(upbitVolume24h / 100000000).toFixed(2)}억 KRW`,
            );
            continue; // 거래량이 적으면 다음 코인으로 넘어감
          }
          this.logger.verbose(
            `[LP_VOLUME_OK] ${watched.symbol.toUpperCase()} 거래량 통과: ${(upbitVolume24h / 100000000).toFixed(2)}억 KRW`,
          );
        } catch (error) {
          this.logger.warn(
            `[LP_FILTER] Failed to get ticker info for ${watched.symbol}: ${error.message}`,
          );
          continue; // 티커 정보 조회 실패 시에도 다음 코인으로 넘어감
        }

        let slippagePercent = 0;
        try {
          const upbitOrderBook = this.priceFeedService.getUpbitOrderBook(
            watched.symbol,
          );

          if (!upbitOrderBook) {
            this.logger.warn(
              `[LP_FILTER] No cached order book for ${watched.symbol}. Skipping.`,
            );
            continue;
          }

          const slippageResult = this.slippageCalculatorService.calculate(
            upbitOrderBook,
            'buy', // LP 단계는 업비트에서 '매수'로 시작
            lowPremiumInvestmentKRW,
          );
          slippagePercent = slippageResult.slippagePercent;

          // 예상 슬리피지가 너무 크면(예: 1%) 해당 코인 건너뛰기
          if (slippagePercent > 1) {
            this.logger.verbose(
              `[LP_FILTER] Skipped ${watched.symbol} (High Slippage: ${slippagePercent.toFixed(2)}%)`,
            );
            continue;
          }
          this.logger.verbose(
            `[LP_SLIPPAGE_OK] ${watched.symbol.toUpperCase()} 슬리피지 통과: ${slippagePercent.toFixed(2)}%`,
          );
        } catch (error) {
          this.logger.warn(
            `[LP_FILTER] Failed to check slippage for ${watched.symbol}: ${error.message}`,
          );
          continue;
        }

        const amount = lowPremiumInvestmentKRW / upbitPrice; // 근사치 수량
        if (amount <= 0 || isNaN(amount)) continue;

        const feeResult = this.feeCalculatorService.calculate({
          symbol: watched.symbol,
          amount,
          upbitPrice, // 슬리피지 계산기에서 나온 평균 체결가를 사용하면 더 정확
          binancePrice,
          rate: currentRateForLowPremium,
          tradeDirection: 'LOW_PREMIUM_SELL_BINANCE',
        });

        // feeResult.netProfitPercent에서 예상 슬리피지를 차감하여 최종 기대 수익률 계산
        const finalExpectedProfitPercent =
          feeResult.netProfitPercent - slippagePercent;
        const finalExpectedProfitKrw =
          feeResult.netProfit -
          (lowPremiumInvestmentKRW * slippagePercent) / 100;

        this.logger.verbose(
          `[LPP_EVAL] ${watched.symbol.toUpperCase()}: NetProfitKRW: ${feeResult.netProfit.toFixed(0)} vs RequiredKRW: ${allowedLossKrw.toFixed(0)}`,
        );

        const expectedLossKrw = Math.abs(finalExpectedProfitKrw);
        const expectedLossPercent = Math.abs(finalExpectedProfitPercent);

        this.logger.verbose(
          `[LPP_PROFIT_ANALYSIS] ${watched.symbol.toUpperCase()}:`,
        );
        this.logger.verbose(`  ├ 업비트 매수가: ${upbitPrice.toFixed(0)} KRW`);
        this.logger.verbose(
          `  ├ 바이낸스 매도가: ${binancePrice.toFixed(4)} USDT`,
        );
        this.logger.verbose(
          `  ├ 수수료 후 수익률: ${feeResult.netProfitPercent.toFixed(2)}%`,
        );
        this.logger.verbose(`  ├ 슬리피지: ${slippagePercent.toFixed(2)}%`);
        this.logger.verbose(
          `  ├ 최종 예상 손실: ${expectedLossKrw.toFixed(0)} KRW (${expectedLossPercent.toFixed(2)}%)`,
        );
        this.logger.verbose(`  └ 허용 범위: ${allowedLossKrw.toFixed(0)} KRW`);

        // 최종 수정된 로직: 이 거래의 실제 손익(NetProfitKrw)이 사이클 목표를 위해
        // 감수 가능한 손익(RequiredKrw)보다 좋은지 여부만 확인합니다.
        if (expectedLossKrw <= allowedLossKrw) {
          candidateCount++; // 🔥 추가: 후보 카운트 증가
          this.logger.verbose(
            `[LPP_CANDIDATE] ${watched.symbol.toUpperCase()}: 예상 손실 ${expectedLossKrw.toFixed(0)} KRW (${expectedLossPercent.toFixed(2)}%)가 허용 범위 ${allowedLossKrw.toFixed(0)} KRW 내에 있습니다.`,
          );

          if (
            !bestLowPremiumOpportunity ||
            expectedLossKrw < bestLowPremiumOpportunity.expectedLossKrw // 🔥 손실이 적은 것을 선택
          ) {
            bestLowPremiumOpportunity = {
              symbol: watched.symbol,
              upbitPrice,
              binancePrice,
              expectedNetProfitKrw: finalExpectedProfitKrw,
              expectedNetProfitRatePercent: finalExpectedProfitPercent,
              expectedLossKrw: expectedLossKrw, // 🔥 추가
              expectedLossPercent: expectedLossPercent, // 🔥 추가
              rate: currentRateForLowPremium,
            };
            this.logger.verbose(
              `[LPP_BEST_UPDATE] ${watched.symbol.toUpperCase()}가 새로운 최적 후보로 선정되었습니다.`,
            );
          }
        } else {
          this.logger.verbose(
            `[LPP_REJECTED] ${watched.symbol.toUpperCase()}: 예상 손실 ${expectedLossKrw.toFixed(0)} KRW가 허용 범위 ${allowedLossKrw.toFixed(0)} KRW를 초과합니다.`,
          );
        }
      }
    }

    if (bestLowPremiumOpportunity) {
      // 🔥 추가: 탐색 결과 요약 로그
      const totalExpectedProfitKrw =
        (actualHighPremiumNetProfitKrw || 0) +
        bestLowPremiumOpportunity.expectedNetProfitKrw;
      const totalExpectedProfitPercent =
        lowPremiumInvestmentKRW > 0
          ? (totalExpectedProfitKrw / lowPremiumInvestmentKRW) * 100
          : 0;
      this.logger.verbose(`[LPP_SEARCH_SUMMARY] 저프리미엄 탐색 완료:`);
      this.logger.verbose(
        ` - 코인: ${bestLowPremiumOpportunity.symbol.toUpperCase()}`,
      );
      this.logger.verbose(
        ` - 예상 손실: ${bestLowPremiumOpportunity.expectedLossKrw.toFixed(0)} KRW (${bestLowPremiumOpportunity.expectedLossPercent.toFixed(2)}%)`,
      );
      this.logger.verbose(
        ` - 업비트 매수가: ${bestLowPremiumOpportunity.upbitPrice.toFixed(0)} KRW`,
      );
      this.logger.verbose(
        ` - 바이낸스 매도가: ${bestLowPremiumOpportunity.binancePrice.toFixed(4)} USDT`,
      );
      this.logger.verbose(
        ` - 투자금: ${lowPremiumInvestmentKRW.toFixed(0)} KRW`,
      );
      // 🔥 추가: 전체 사이클 예상 결과
      this.logger.verbose(`[LPP_CYCLE_FORECAST] 전체 사이클 예상 결과:`);
      this.logger.verbose(
        ` - 고프리미엄 수익: ${actualHighPremiumNetProfitKrw?.toFixed(0) || 'N/A'} KRW`,
      );
      this.logger.verbose(
        ` - 저프리미엄 손실: ${bestLowPremiumOpportunity.expectedLossKrw.toFixed(0)} KRW`,
      );
      this.logger.verbose(
        ` - 전체 예상 수익: ${totalExpectedProfitKrw.toFixed(0)} KRW (${totalExpectedProfitPercent.toFixed(2)}%)`,
      );

      if (!this.cycleStateService.startLowPremiumProcessing()) {
        this.logger.warn(
          `[LPP_FOUND_BUT_SKIPPED] 상태 변경 실패. ${bestLowPremiumOpportunity.symbol.toUpperCase()} 건너뜁니다. (Cycle ID: ${activeCycleId})`,
        );
        return null;
      }
      this.logger.verbose(
        `✅ [LPP_FOUND] 최적 코인: ${bestLowPremiumOpportunity.symbol.toUpperCase()} (예상 손실: ${bestLowPremiumOpportunity.expectedLossKrw.toFixed(0)} KRW, 예상 손실률: ${bestLowPremiumOpportunity.expectedLossPercent.toFixed(3)}%). 투자금 ${lowPremiumInvestmentKRW.toFixed(0)} KRW로 저프리미엄 단계 진행.`,
      );

      try {
        // .env 파일의 UPBIT_MODE 설정을 가져옵니다. (저프리미엄은 업비트에서 시작)
        const mode = this.configService.get<string>('UPBIT_MODE');

        if (mode === 'REAL') {
          // ========== REAL 모드 실행 블록 ==========
          this.logger.warn(
            `[REAL-MODE] 🔄 [LOW_PREMIUM_START] ${bestLowPremiumOpportunity.symbol.toUpperCase()} 실제 거래 시작. (ID: ${activeCycleId})`,
          );

          // 시뮬레이션 시간 지연 없이, 실제 거래 흐름을 담당하는 서비스를 직접 호출합니다.
          await this.strategyLowService.handleLowPremiumFlow(
            bestLowPremiumOpportunity.symbol,
            bestLowPremiumOpportunity.upbitPrice,
            bestLowPremiumOpportunity.binancePrice,
            bestLowPremiumOpportunity.rate,
            activeCycleId,
            lowPremiumInvestmentKRW,
          );

          this.logger.log(
            `✅ [REAL-MODE] 저프리미엄 ${bestLowPremiumOpportunity.symbol.toUpperCase()} 모든 단계 처리 완료.`,
          );
        } else {
          this.logger.warn(
            `[LPP_NO_OPPORTUNITY] 허용 범위 내의 저프리미엄 기회를 찾지 못했습니다.`,
          );
          this.logger.warn(
            ` - 고프리미엄 수익: ${actualHighPremiumNetProfitKrw?.toFixed(0) || 'N/A'} KRW`,
          );
          this.logger.warn(
            ` - 허용 가능한 손실: ${allowedLossKrw.toFixed(0)} KRW`,
          );
          this.logger.warn(` - 후보 코인 수: ${candidateCount}개`);
          // ========== SIMULATION 모드 실행 블록 (기존 로직) ==========
          const randomSeconds = Math.floor(Math.random() * (60 - 60 + 1)) + 60;
          this.logger.log(
            `⬅️ [SIMULATE_LPP] 저프리미엄 ${bestLowPremiumOpportunity.symbol.toUpperCase()} 매수/송금 시작 (${(randomSeconds / 60).toFixed(1)}분 대기)`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, randomSeconds * 1000),
          );

          // 시뮬레이션 모드에서도 이 함수를 호출하는 것은 기존 로직과 동일
          await this.strategyLowService.handleLowPremiumFlow(
            bestLowPremiumOpportunity.symbol,
            bestLowPremiumOpportunity.upbitPrice,
            bestLowPremiumOpportunity.binancePrice,
            bestLowPremiumOpportunity.rate,
            activeCycleId,
            lowPremiumInvestmentKRW,
          );
        }

        const finalCycleStatus =
          await this.arbitrageRecordService.getArbitrageCycle(activeCycleId);
        if (!finalCycleStatus || finalCycleStatus.status !== 'COMPLETED') {
          throw new Error(
            `저프리미엄 단계 (${activeCycleId}) 후 사이클이 DB에서 COMPLETED 상태로 확인되지 않았습니다 (LPP): ${finalCycleStatus?.status}`,
          );
        }
        return {
          success: true,
          cycleId: activeCycleId,
          finalStatus: finalCycleStatus,
        };
      } catch (error) {
        this.logger.error(
          `❌ [LPP_ERROR] 저프리미엄 처리 중 오류 (Cycle ID: ${activeCycleId}): ${(error as Error).message}`,
          (error as Error).stack,
        );
        await this.arbitrageRecordService.updateArbitrageCycle(activeCycleId, {
          status: 'FAILED',
          errorDetails: `저프리미엄 처리 중 오류 LPP: ${(error as Error).message}`,
          endTime: new Date(),
        });
        return {
          success: false,
          cycleId: activeCycleId,
          finalStatus:
            await this.arbitrageRecordService.getArbitrageCycle(activeCycleId),
          error: error as Error,
        };
      }
    }

    // 타임아웃 로직
    const elapsedTimeMs = Date.now() - searchStartTime;
    if (elapsedTimeMs > this.MAX_SEARCH_DURATION_MS) {
      this.logger.warn(
        `[LPP_MAX_DURATION_NO_OPP] 최대 탐색 기간 후에도 저프리미엄 기회 없음 (Cycle ID: ${activeCycleId}). 사이클 종료.`,
      );
      const highPremiumResult =
        await this.arbitrageRecordService.getArbitrageCycle(activeCycleId);
      const actualHighPremiumNetProfitKrw = this.parseAndValidateNumber(
        highPremiumResult?.highPremiumNetProfitKrw,
      );

      await this.arbitrageRecordService.updateArbitrageCycle(activeCycleId, {
        status: 'HP_ONLY_COMPLETED_TARGET_MISSED',
        errorDetails: `최대 탐색 기간(${(this.MAX_SEARCH_DURATION_MS / 1000 / 60 / 60).toFixed(1)}h) 후 저프리미엄 기회 없음. (LPP)`,
        endTime: new Date(),
        totalNetProfitKrw: actualHighPremiumNetProfitKrw,
        totalNetProfitUsd:
          actualHighPremiumNetProfitKrw !== null &&
          this.cycleStateService.highPremiumInitialRateForActiveCycle !== null
            ? actualHighPremiumNetProfitKrw /
              this.cycleStateService.highPremiumInitialRateForActiveCycle
            : null,
        totalNetProfitPercent:
          actualHighPremiumNetProfitKrw !== null &&
          lowPremiumInvestmentKRW > 0 &&
          cycleInfoForLowPremium.initialInvestmentKrw
            ? (actualHighPremiumNetProfitKrw /
                this.parseAndValidateNumber(
                  cycleInfoForLowPremium.initialInvestmentKrw,
                )!) *
              100
            : null,
      });

      return {
        success: false,
        cycleId: activeCycleId,
        finalStatus:
          await this.arbitrageRecordService.getArbitrageCycle(activeCycleId),
        error: new Error('Max search duration reached with no opportunity.'),
      };
    }

    // 아직 기회를 못 찾았고 타임아웃도 아니라면 null을 반환하여 다음을 기약
    return null;
  }

  public async processLowPremiumForSession(
    session: ISession,
  ): Promise<LowPremiumResult | null> {
    this.logger.log(`[LPP_SESSION] 세션별 LP 처리 시작: ${session.id}`);

    if (!session.highPremiumData) {
      this.logger.error(
        `[LPP_SESSION] 세션 ${session.id}에 고프리미엄 데이터가 없습니다.`,
      );
      return null;
    }

    // 세션의 고프리미엄 데이터에서 필요한 정보 추출
    const highPremiumProfit = session.highPremiumData.expectedProfit;
    const highPremiumSymbol = session.highPremiumData.symbol;
    const investmentKRW = session.highPremiumData.investmentKRW;

    // 허용 손실 계산 (고프리미엄 수익의 80%까지 허용)
    const allowedLossKrw = highPremiumProfit * 0.8;

    // 세션별 독립적인 cycleId 생성
    const sessionCycleId =
      session.cycleId || `session_${session.id}_${Date.now()}`;

    this.logger.verbose(`[LPP_SESSION] 세션 ${session.id} LP 탐색 조건:`);
    this.logger.verbose(
      ` - 고프리미엄 수익: ${highPremiumProfit.toFixed(0)} KRW`,
    );
    this.logger.verbose(` - 허용 손실: ${allowedLossKrw.toFixed(0)} KRW`);
    this.logger.verbose(` - 제외 코인: ${highPremiumSymbol.toUpperCase()}`);
    this.logger.verbose(` - 세션 Cycle ID: ${sessionCycleId}`);
    // 저프리미엄 기회 탐색
    const opportunity = await this.findLowPremiumOpportunityForSession(
      highPremiumSymbol,
      allowedLossKrw,
      investmentKRW,
    );

    if (opportunity) {
      this.logger.verbose(
        `[LPP_SESSION] 세션 ${session.id}에서 LP 기회 발견: ${opportunity.symbol.toUpperCase()}`,
      );

      // LP 거래 실행
      try {
        const mode = this.configService.get<string>('UPBIT_MODE');

        if (mode === 'REAL') {
          this.logger.warn(
            `[LPP_SESSION_REAL] 세션 ${session.id} 실제 LP 거래 시작: ${opportunity.symbol.toUpperCase()}`,
          );

          await this.strategyLowService.handleLowPremiumFlow(
            opportunity.symbol,
            opportunity.upbitPrice,
            opportunity.binancePrice,
            opportunity.rate,
            sessionCycleId,
            investmentKRW,
          );

          this.logger.log(`[LPP_SESSION_REAL] 세션 ${session.id} LP 거래 완료`);
        } else {
          // SIMULATION 모드
          const randomSeconds = Math.floor(Math.random() * 60) + 60;
          this.logger.verbose(
            `[LPP_SESSION_SIM] 세션 ${session.id} LP 시뮬레이션 시작 (${randomSeconds}초 대기)`,
          );

          await new Promise((resolve) =>
            setTimeout(resolve, randomSeconds * 1000),
          );

          await this.strategyLowService.handleLowPremiumFlow(
            opportunity.symbol,
            opportunity.upbitPrice,
            opportunity.binancePrice,
            opportunity.rate,
            sessionCycleId,
            investmentKRW,
          );
        }

        // 성공 결과 반환
        return {
          success: true,
          cycleId: sessionCycleId,
          finalStatus: null, // 세션별 처리이므로 사이클 상태는 null
        };
      } catch (error) {
        this.logger.error(
          `[LPP_SESSION_ERROR] 세션 ${session.id} LP 처리 중 오류: ${error.message}`,
        );

        return {
          success: false,
          cycleId: sessionCycleId,
          finalStatus: null,
          error: error as Error,
        };
      }
    } // 기회를 찾지 못한 경우
    this.logger.debug(
      `[LPP_SESSION] 세션 ${session.id}에서 적절한 LP 기회를 찾지 못했습니다.`,
    );

    return {
      success: false,
      cycleId: sessionCycleId,
      finalStatus: null,
      error: new Error('No suitable low premium opportunity found'),
    };
  }

  // 세션별 저프리미엄 기회 탐색 (기존 로직 재사용)
  private async findLowPremiumOpportunityForSession(
    excludeSymbol: string,
    allowedLossKrw: number,
    investmentKRW: number,
  ): Promise<LowPremiumOpportunity | null> {
    let bestLowPremiumOpportunity: LowPremiumOpportunity | null = null;
    let bestLossKrw = allowedLossKrw;

    const currentRateForLowPremium = this.exchangeService.getUSDTtoKRW();

    for (const watched of this.watchedSymbols) {
      // 고프리미엄 코인은 제외
      if (watched.symbol === excludeSymbol) {
        continue;
      }

      const upbitPrice = this.priceFeedService.getUpbitPrice(watched.symbol);
      const binancePrice = this.priceFeedService.getBinancePrice(
        watched.symbol,
      );

      if (upbitPrice && binancePrice && investmentKRW > 0) {
        // 유동성 필터링
        try {
          const upbitVolume24h = this.priceFeedService.getUpbitVolume(
            watched.symbol,
          );
          if (upbitVolume24h < this.MINIMUM_VOLUME_KRW) {
            continue;
          }
        } catch (error) {
          this.logger.error(
            `[LPP_SESSION] 유동성 필터링 중 오류: ${error.message}`,
          );
          continue;
        }

        // 슬리피지 계산
        let slippagePercent = 0;
        try {
          const upbitOrderBook = this.priceFeedService.getUpbitOrderBook(
            watched.symbol,
          );
          if (!upbitOrderBook) {
            continue;
          }
          const slippageResult = this.slippageCalculatorService.calculate(
            upbitOrderBook,
            'buy',
            investmentKRW,
          );
          slippagePercent = slippageResult.slippagePercent;

          if (slippagePercent > 1) {
            continue;
          }
        } catch (error) {
          this.logger.error(
            `[LPP_SESSION] 슬리피지 계산 중 오류: ${error.message}`,
          );
          continue;
        }

        // 수수료 계산
        const amount = investmentKRW / upbitPrice;
        const feeResult = this.feeCalculatorService.calculate({
          symbol: watched.symbol,
          amount,
          upbitPrice,
          binancePrice,
          rate: currentRateForLowPremium,
          tradeDirection: 'LOW_PREMIUM_SELL_BINANCE',
        });

        // 최종 예상 손실 계산
        const finalExpectedProfitPercent =
          feeResult.netProfitPercent - slippagePercent;
        const finalExpectedProfitKrw =
          feeResult.netProfit - (investmentKRW * slippagePercent) / 100;
        const expectedLossKrw = Math.abs(finalExpectedProfitKrw);

        // 허용 손실 범위 내에서 최적 기회 선택
        if (
          expectedLossKrw <= allowedLossKrw &&
          expectedLossKrw < bestLossKrw
        ) {
          bestLowPremiumOpportunity = {
            symbol: watched.symbol,
            upbitPrice,
            binancePrice,
            expectedNetProfitKrw: finalExpectedProfitKrw,
            expectedNetProfitRatePercent: finalExpectedProfitPercent,
            expectedLossKrw: expectedLossKrw,
            expectedLossPercent: Math.abs(finalExpectedProfitPercent),
            rate: currentRateForLowPremium,
          };
          bestLossKrw = expectedLossKrw;

          this.logger.verbose(
            `[LPP_SESSION_BEST] ${watched.symbol.toUpperCase()} 새로운 최적 후보: 예상 손실 ${expectedLossKrw.toFixed(0)} KRW`,
          );
        }
      }
    }

    return bestLowPremiumOpportunity;
  }
}
