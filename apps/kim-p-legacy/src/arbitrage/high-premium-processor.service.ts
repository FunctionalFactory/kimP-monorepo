import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ArbitrageCycleStateService } from './arbitrage-cycle-state.service';
import { PortfolioLogService } from '../db/portfolio-log.service';
import { ArbitrageRecordService } from '../db/arbitrage-record.service';
import { ArbitrageService } from '../common/arbitrage.service';
import { ArbitrageCycle } from '../db/entities/arbitrage-cycle.entity';
import { ExchangeService } from 'src/common/exchange.service';
import { StrategyHighService } from 'src/common/strategy-high.service';
import { SlippageCalculatorService } from 'src/common/slippage-calculator.service';
import { TelegramService } from 'src/common/telegram.service';
import { InvestmentConfigService } from '../config/investment-config.service';

export interface HighPremiumConditionData {
  symbol: string;
  upbitPrice: number;
  binancePrice: number;
  rate: number;
  netProfit: number;
  netProfitPercent: number;
}

@Injectable()
export class HighPremiumProcessorService {
  private readonly logger = new Logger(HighPremiumProcessorService.name);

  private readonly TARGET_OVERALL_CYCLE_PROFIT_PERCENT: number;
  private readonly INITIAL_CAPITAL_KRW: number;
  private readonly MINIMUM_VOLUME_KRW = 5000000000; // 최소 거래대금 100억 원

  constructor(
    private readonly configService: ConfigService,
    private readonly cycleStateService: ArbitrageCycleStateService,
    private readonly portfolioLogService: PortfolioLogService,
    private readonly arbitrageRecordService: ArbitrageRecordService,
    private readonly arbitrageService: ArbitrageService,
    private readonly exchangeService: ExchangeService,
    private readonly strategyHighService: StrategyHighService,
    private readonly slippageCalculatorService: SlippageCalculatorService, // ⭐️ 주입 추가
    private readonly telegramService: TelegramService, // 추가
    private readonly investmentConfigService: InvestmentConfigService,
  ) {
    this.logger.log(
      `[초기화] HighPremiumProcessorService 초기화 완료. 최소 거래대금 기준: ${(this.MINIMUM_VOLUME_KRW / 100000000).toFixed(2)}억 KRW`,
    );

    this.TARGET_OVERALL_CYCLE_PROFIT_PERCENT =
      this.configService.get<number>('TARGET_OVERALL_CYCLE_PROFIT_PERCENT') ||
      0.1;
    this.INITIAL_CAPITAL_KRW =
      this.configService.get<number>('INITIAL_CAPITAL_KRW') || 1500000;
  }

  private parseAndValidateNumber(value: any): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  public async processHighPremiumOpportunity(
    data: HighPremiumConditionData,
  ): Promise<{
    success: boolean;
    nextStep?: 'awaitLowPremium' | 'failed';
    cycleId?: string | null;
  }> {
    this.logger.verbose(
      `Processing high premium opportunity for ${data.symbol}`,
    );

    if (!this.validateHighPremiumData(data)) {
      this.logger.error(`Invalid high premium data for ${data.symbol}`);
      return { success: false, nextStep: 'failed' };
    }

    let latestPortfolioLog =
      await this.portfolioLogService.getLatestPortfolio();
    let currentTotalKRWCapital: number;

    if (latestPortfolioLog && latestPortfolioLog.total_balance_krw !== null) {
      currentTotalKRWCapital =
        this.parseAndValidateNumber(latestPortfolioLog.total_balance_krw) ||
        this.INITIAL_CAPITAL_KRW;
    } else {
      const mode = this.configService.get('BINANCE_MODE');
      this.logger.warn(
        `No portfolio log found. Initializing portfolio in ${mode || 'REAL'} mode...`,
      );

      if (mode === 'SIMULATION') {
        // --- 시뮬레이션 모드 로직 ---
        currentTotalKRWCapital = this.INITIAL_CAPITAL_KRW;
        this.logger.log(
          `[SIMULATION] Starting with configured initial capital: ${currentTotalKRWCapital.toFixed(0)} KRW`,
        );

        latestPortfolioLog = await this.portfolioLogService.createLog({
          timestamp: new Date(),
          upbit_balance_krw: 0,
          binance_balance_krw: currentTotalKRWCapital, // 시뮬레이션에서도 바이낸스에 자본이 있는 것으로 가정
          total_balance_krw: currentTotalKRWCapital,
          cycle_pnl_krw: 0,
          cycle_pnl_rate_percent: 0,
          remarks:
            'System Start: Initial portfolio log created for SIMULATION mode.',
        });
      } else {
        // --- 실전 모드 로직 ---
        const binanceBalances =
          await this.exchangeService.getBalances('binance');
        const usdtBalance =
          binanceBalances.find((b) => b.currency === 'USDT')?.available || 0;

        const rate = this.exchangeService.getUSDTtoKRW();
        if (usdtBalance <= 0 || rate <= 0) {
          throw new Error(
            `Cannot initialize portfolio for REAL mode. Binance USDT balance is ${usdtBalance} or rate is ${rate}.`,
          );
        }

        const initialBinanceKrw = usdtBalance * rate;
        currentTotalKRWCapital = initialBinanceKrw;

        this.logger.verbose(
          `[REAL] Initial portfolio value calculated: ${currentTotalKRWCapital.toFixed(
            0,
          )} KRW (from ${usdtBalance.toFixed(2)} USDT)`,
        );
        latestPortfolioLog = await this.portfolioLogService.createLog({
          timestamp: new Date(),
          upbit_balance_krw: 0,
          binance_balance_krw: currentTotalKRWCapital,
          total_balance_krw: currentTotalKRWCapital,
          cycle_pnl_krw: 0,
          cycle_pnl_rate_percent: 0,
          remarks:
            'System Start: Initial portfolio log created from REAL Binance balance.',
        });
      }
    }

    if (currentTotalKRWCapital <= 0) {
      this.logger.error(
        `Total capital is ${currentTotalKRWCapital.toFixed(0)} KRW. Cannot start arbitrage.`,
      );
      return { success: false, nextStep: 'failed' };
    }

    const highPremiumInvestmentKRW =
      this.investmentConfigService.calculateInvestmentAmount(
        currentTotalKRWCapital,
      );

    this.logger.verbose(
      `[INVESTMENT] 중앙화된 설정으로 계산된 투자금: ${highPremiumInvestmentKRW.toLocaleString()} KRW`,
    );

    if (
      typeof highPremiumInvestmentKRW !== 'number' ||
      isNaN(highPremiumInvestmentKRW)
    ) {
      this.logger.error(
        `[INVESTMENT] 투자금이 유효하지 않습니다: ${highPremiumInvestmentKRW}`,
      );
      return { success: false, nextStep: 'failed' };
    }

    const highPremiumInitialRate = data.rate;
    const highPremiumInvestmentUSDT =
      highPremiumInvestmentKRW / highPremiumInitialRate;

    let tempCycleIdRecord: ArbitrageCycle | null = null;

    try {
      tempCycleIdRecord =
        await this.arbitrageRecordService.createArbitrageCycle({
          startTime: new Date(),
          initialInvestmentKrw: highPremiumInvestmentKRW,
          initialInvestmentUsd: highPremiumInvestmentUSDT,
          highPremiumSymbol: data.symbol,
          highPremiumBinanceBuyPriceUsd: data.binancePrice,
          highPremiumInitialRate: highPremiumInitialRate,
          highPremiumBuyAmount: this.calculateSafeBuyAmount(
            highPremiumInvestmentUSDT,
            data.binancePrice,
          ),
          highPremiumSpreadPercent: this.calculateSafeSpreadPercent(
            data.upbitPrice,
            data.binancePrice,
            highPremiumInitialRate,
          ),
        });

      this.cycleStateService.startHighPremiumProcessing(
        tempCycleIdRecord.id,
        latestPortfolioLog,
      );

      this.logger.warn(
        `✨ [HIGH_PREMIUM_START] ${data.symbol.toUpperCase()} ... 총 자본 ${highPremiumInvestmentKRW.toFixed(0)} KRW로 사이클 시작! (ID: ${this.cycleStateService.activeCycleId})`,
      );

      const mode = this.configService.get<string>('BINANCE_MODE');

      // [수정된 부분] 새로운 객체를 만드는 대신, 필요한 모든 정보가 담긴 'data'를 그대로 전달합니다.
      if (mode === 'REAL') {
        // ========== REAL 모드 실행 블록 ==========
        this.logger.warn(
          `[REAL-MODE] ✨ [HIGH_PREMIUM_START] ${data.symbol.toUpperCase()} 실제 거래 시작. (ID: ${this.cycleStateService.activeCycleId})`,
        );

        // 실제 거래 흐름(매수->폴링->출금->폴링->매도->폴링)을 담당하는 서비스를 직접 호출합니다.
        await this.strategyHighService.handleHighPremiumFlow(
          data.symbol,
          data.upbitPrice,
          data.binancePrice,
          data.rate,
          this.cycleStateService.activeCycleId!,
          highPremiumInvestmentUSDT,
        );

        this.logger.log(
          `✅ [REAL-MODE] 고프리미엄 ${data.symbol.toUpperCase()} 모든 단계 처리 완료.`,
        );
      } else {
        // ========== SIMULATION 모드 실행 블록 (기존 로직) ==========
        const randomSeconds = Math.floor(Math.random() * (60 - 60 + 1)) + 60;
        this.logger.log(
          `➡️ [SIMULATE] 고프리미엄 ${data.symbol.toUpperCase()} 매수 및 송금 시작 (${(randomSeconds / 60).toFixed(1)}분 대기)`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, randomSeconds * 1000),
        );

        await this.arbitrageService.simulateArbitrage(
          data,
          this.cycleStateService.activeCycleId!,
          highPremiumInvestmentUSDT,
        );

        this.logger.log(
          `✅ [SIMULATE] 고프리미엄 ${data.symbol.toUpperCase()} 매매/송금 시뮬레이션 완료.`,
        );
      }

      const highPremiumCompletedCycle =
        await this.arbitrageRecordService.getArbitrageCycle(
          this.cycleStateService.activeCycleId!,
        );
      if (
        !highPremiumCompletedCycle ||
        highPremiumCompletedCycle.status !== 'HP_SOLD'
      ) {
        throw new Error(
          `고프리미엄 단계 (${this.cycleStateService.activeCycleId})가 DB에서 HP_SOLD 상태로 확인되지 않았습니다. Status: ${highPremiumCompletedCycle?.status}`,
        );
      }

      const actualHighPremiumNetProfitKrw = this.parseAndValidateNumber(
        highPremiumCompletedCycle.highPremiumNetProfitKrw,
      );
      if (actualHighPremiumNetProfitKrw === null) {
        throw new Error(
          `고프리미엄 순이익(KRW)을 DB에서 가져올 수 없습니다 (사이클 ID: ${this.cycleStateService.activeCycleId}).`,
        );
      }
      this.logger.log(
        `📈 [HIGH_PREMIUM_RESULT] ${data.symbol.toUpperCase()} 실제 순이익: ${actualHighPremiumNetProfitKrw.toFixed(0)} KRW`,
      );

      const lowPremiumInvestmentKRW =
        highPremiumInvestmentKRW + actualHighPremiumNetProfitKrw;

      const overallTargetProfitKrw =
        (currentTotalKRWCapital * this.TARGET_OVERALL_CYCLE_PROFIT_PERCENT) /
        100;
      const requiredLowPremiumProfit =
        overallTargetProfitKrw - actualHighPremiumNetProfitKrw;

      const allowedLossKrw = Math.abs(requiredLowPremiumProfit);

      this.logger.verbose(
        `[HPP] 고프리미엄 수익: ${actualHighPremiumNetProfitKrw.toFixed(0)} KRW, 허용 가능한 저프리미엄 손실: ${allowedLossKrw.toFixed(0)} KRW`,
      );

      this.cycleStateService.setAllowedLowPremiumLoss(allowedLossKrw);

      this.cycleStateService.setLowPremiumInvestment(lowPremiumInvestmentKRW);

      await this.arbitrageRecordService.updateArbitrageCycle(
        this.cycleStateService.activeCycleId!,
        { status: 'AWAITING_LP' },
      );

      this.cycleStateService.completeHighPremiumAndAwaitLowPremium(
        requiredLowPremiumProfit,
        highPremiumInitialRate,
      );

      // HP 완료 텔레그램 알림 추가
      await this.sendHighPremiumCompletionNotification(
        this.cycleStateService.activeCycleId!,
        data.symbol,
        actualHighPremiumNetProfitKrw,
        highPremiumInvestmentKRW,
        highPremiumInitialRate,
      );

      this.logger.verbose(
        `🎯 [AWAITING_LOW_PREMIUM] 고프리미엄 완료. 저프리미엄 탐색 준비. (Cycle ID: ${this.cycleStateService.activeCycleId}, 필요 최소 수익 KRW: ${requiredLowPremiumProfit.toFixed(0)})`,
      );

      return {
        success: true,
        nextStep: 'awaitLowPremium',
        cycleId: this.cycleStateService.activeCycleId,
      };
    } catch (error) {
      const cycleIdToLog =
        this.cycleStateService.activeCycleId || tempCycleIdRecord?.id;
      this.logger.error(
        `❌ [HIGH_PREMIUM_PROCESSOR_ERROR] 고프리미엄 처리 중 오류 (Cycle ID: ${cycleIdToLog || 'N/A'}): ${(error as Error).message}`,
        (error as Error).stack,
      );

      if (cycleIdToLog) {
        await this.arbitrageRecordService.updateArbitrageCycle(cycleIdToLog, {
          status: 'FAILED',
          errorDetails: `고프리미엄 처리 중 예외: ${(error as Error).message}`,
          endTime: new Date(),
        });
      }

      return { success: false, nextStep: 'failed', cycleId: cycleIdToLog };
    }
  }
  private async sendHighPremiumCompletionNotification(
    cycleId: string,
    symbol: string,
    netProfitKrw: number,
    investmentKrw: number,
    rate: number,
  ): Promise<void> {
    try {
      const profitPercent = (netProfitKrw / investmentKrw) * 100;
      const netProfitUsd = netProfitKrw / rate;

      const message =
        `✅ *[고프리미엄 완료]* 사이클 ${cycleId}\n` +
        `코인: ${symbol.toUpperCase()}\n` +
        `투자금: ${investmentKrw.toFixed(0)} KRW\n` +
        `순이익: ${netProfitKrw.toFixed(0)} KRW (${netProfitUsd.toFixed(2)} USD)\n` +
        `수익률: ${profitPercent.toFixed(2)}%\n` +
        `➡️ 저프리미엄 탐색 시작`;

      await this.telegramService.sendMessage(message);
      this.logger.log(
        `[HP_NOTIFICATION] 고프리미엄 완료 알림 전송: ${cycleId}`,
      );
    } catch (error) {
      this.logger.error(
        `[HP_NOTIFICATION] 텔레그램 알림 전송 실패: ${error.message}`,
      );
    }
  }
  // 데이터 검증 메서드 추가
  private validateHighPremiumData(data: HighPremiumConditionData): boolean {
    if (!data.symbol || typeof data.symbol !== 'string') {
      this.logger.error('Invalid symbol in high premium data');
      return false;
    }

    if (!this.isValidNumber(data.upbitPrice) || data.upbitPrice <= 0) {
      this.logger.error(`Invalid upbit price: ${data.upbitPrice}`);
      return false;
    }

    if (!this.isValidNumber(data.binancePrice) || data.binancePrice <= 0) {
      this.logger.error(`Invalid binance price: ${data.binancePrice}`);
      return false;
    }

    if (!this.isValidNumber(data.rate) || data.rate <= 0) {
      this.logger.error(`Invalid rate: ${data.rate}`);
      return false;
    }

    return true;
  }
  // 안전한 숫자 검증 메서드
  private isValidNumber(value: any): boolean {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  }

  // 안전한 매수 수량 계산
  private calculateSafeBuyAmount(
    investmentUSDT: number,
    binancePrice: number,
  ): number {
    if (!this.isValidNumber(binancePrice) || binancePrice <= 0) {
      this.logger.warn(
        'Invalid binance price for buy amount calculation, using 0',
      );
      return 0;
    }
    return investmentUSDT / binancePrice;
  }

  // 안전한 스프레드 퍼센트 계산
  private calculateSafeSpreadPercent(
    upbitPrice: number,
    binancePrice: number,
    rate: number,
  ): number {
    if (
      !this.isValidNumber(binancePrice) ||
      binancePrice <= 0 ||
      !this.isValidNumber(rate) ||
      rate <= 0
    ) {
      this.logger.warn('Invalid values for spread calculation, using 0');
      return 0;
    }

    const binancePriceKrw = binancePrice * rate;
    if (binancePriceKrw <= 0) {
      this.logger.warn('Invalid binance price in KRW, using 0');
      return 0;
    }

    return ((upbitPrice - binancePriceKrw) / binancePriceKrw) * 100;
  }
}
