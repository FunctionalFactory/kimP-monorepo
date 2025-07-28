import { Injectable, Logger } from '@nestjs/common';
import { ISession, SessionStatus } from './interfaces/session.interface';
import { SessionStateService } from './session-state.service';
import { SessionPriorityService } from './session-priority.service';
import { ArbitrageFlowManagerService } from '../arbitrage/arbitrage-flow-manager.service';
import { HighPremiumProcessorService } from '../arbitrage/high-premium-processor.service';
import {
  LowPremiumProcessorService,
  LowPremiumResult,
} from '../arbitrage/low-premium-processor.service';
import { PriceFeedService } from '../marketdata/price-feed.service';
import { SpreadCalculatorService } from '../common/spread-calculator.service';
import { PortfolioLogService } from '../db/portfolio-log.service';
import { ExchangeService } from '../common/exchange.service';
import { ConfigService } from '@nestjs/config';
import { SessionFundValidationService } from 'src/db/session-fund-validation.service';
import { ArbitrageRecordService } from 'src/db/arbitrage-record.service';
import { StrategyLowService } from '../common/strategy-low.service';
import { SlippageCalculatorService } from '../common/slippage-calculator.service';
import { FeeCalculatorService } from '../common/fee-calculator.service';
import { InvestmentConfigService } from 'src/config/investment-config.service';
import { PortfolioManagerService } from '../common/portfolio-manager.service';

@Injectable()
export class SessionExecutorService {
  private readonly logger = new Logger(SessionExecutorService.name);
  private isProcessing = false;
  private readonly DECISION_WINDOW_MS = 2000; // 2초의 결정 시간

  constructor(
    private readonly sessionStateService: SessionStateService,
    private readonly sessionPriorityService: SessionPriorityService,
    private readonly arbitrageFlowManagerService: ArbitrageFlowManagerService,
    private readonly highPremiumProcessorService: HighPremiumProcessorService,
    private readonly lowPremiumProcessorService: LowPremiumProcessorService,
    private readonly priceFeedService: PriceFeedService,
    private readonly spreadCalculatorService: SpreadCalculatorService,
    private readonly portfolioLogService: PortfolioLogService,
    private readonly exchangeService: ExchangeService,
    private readonly configService: ConfigService,
    private readonly sessionFundValidationService: SessionFundValidationService,
    private readonly arbitrageRecordService: ArbitrageRecordService,
    private readonly strategyLowService: StrategyLowService,
    private readonly slippageCalculatorService: SlippageCalculatorService,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly investmentConfigService: InvestmentConfigService,
    private readonly portfolioManagerService: PortfolioManagerService,
  ) {}

  async processNextSession(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('[EXECUTOR] 이미 처리 중입니다.');
      return;
    }

    this.isProcessing = true;

    try {
      const activeSessions = this.sessionStateService.getActiveSessions();

      // 🔥 추가: IDLE 상태의 세션이 있는지 확인
      const idleSessions = activeSessions.filter(
        (session) => session.status === SessionStatus.IDLE,
      );

      if (idleSessions.length === 0) {
        // this.logger.debug('[EXECUTOR] 처리할 IDLE 세션이 없습니다.');
        return;
      }

      const nextSession =
        this.sessionPriorityService.getNextSessionToProcess(activeSessions);

      if (!nextSession) {
        // this.logger.debug('[EXECUTOR] 처리할 세션이 없습니다.');
        return;
      }

      await this.executeSession(nextSession);
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeSession(session: ISession): Promise<void> {
    this.logger.log(
      `[EXECUTOR] 세션 실행 시작: ${session.id} (${session.status})`,
    );

    switch (session.status) {
      case SessionStatus.IDLE:
        await this.handleIdleSession(session);
        break;

      case SessionStatus.NORMAL_PROCESSING:
        await this.executeNormalStrategy(session);
        break;

      case SessionStatus.REVERSE_PROCESSING:
        // Reverse 전략은 이미 executeReverseOpportunity에서 처리됨
        this.logger.debug(`[EXECUTOR] Reverse 전략 처리 중: ${session.id}`);
        break;

      case SessionStatus.AWAITING_SECOND_STEP:
        await this.handleSecondStep(session);
        break;

      case SessionStatus.AWAITING_LOW_PREMIUM:
        await this.handleLowPremiumSession(session);
        break;

      case SessionStatus.HIGH_PREMIUM_PROCESSING:
        // 이미 처리 중인 상태는 건너뛰기
        if (session.highPremiumData) {
          // 세션에 저장된 데이터로 opportunity 객체 재구성
          const opportunity = {
            symbol: session.highPremiumData.symbol,
            upbitPrice: session.highPremiumData.upbitPrice,
            binancePrice: session.highPremiumData.binancePrice,
            rate: session.highPremiumData.rate,
            netProfit: session.highPremiumData.expectedProfit,
            netProfitPercent:
              (session.highPremiumData.expectedProfit /
                session.highPremiumData.investmentKRW) *
              100,
            investmentKRW: session.highPremiumData.investmentKRW,
            investmentUSDT: session.highPremiumData.investmentUSDT,
          };

          await this.executeHighPremiumProcessing(session, opportunity);
        } else {
          this.logger.warn(
            `[EXECUTOR] 세션 ${session.id}에 고프리미엄 데이터가 없습니다.`,
          );
          session.status = SessionStatus.FAILED;
          this.sessionStateService.updateSessionStatus(
            session.id,
            SessionStatus.FAILED,
          );
        }
        break;

      default:
        this.logger.warn(
          `[EXECUTOR] 처리할 수 없는 세션 상태: ${session.status}`,
        );
    }
  }

  // 새로운 메서드 추가: 2단계 처리
  private async handleSecondStep(session: ISession): Promise<void> {
    this.logger.log(`[EXECUTOR] 2단계 처리 시작: ${session.id}`);

    if (session.marketDirection === 'NORMAL') {
      // Normal 전략: 저프리미엄 2단계
      await this.handleLowPremiumSession(session);
    } else if (session.marketDirection === 'REVERSE') {
      // Reverse 전략: 고프리미엄 2단계
      await this.handleReverseSecondStep(session);
    }
  }

  // 새로운 메서드 추가: Reverse 전략 2단계 처리
  private async handleReverseSecondStep(session: ISession): Promise<void> {
    this.logger.log(`[EXECUTOR] Reverse 2단계(고프리미엄) 처리: ${session.id}`);

    try {
      const result = await this.executeHighPremiumStep(session);

      if (result && result.success) {
        // Reverse 전략 완료
        session.status = SessionStatus.COMPLETED;
        this.sessionStateService.updateSessionStatus(
          session.id,
          SessionStatus.COMPLETED,
        );

        this.logger.log(`[EXECUTOR] Reverse 전략 완료: ${session.id}`);

        // 자금 상태 업데이트
        await this.sessionFundValidationService.validateSessionFunds();
      } else {
        // 2단계 실패
        session.status = SessionStatus.FAILED;
        this.sessionStateService.updateSessionStatus(
          session.id,
          SessionStatus.FAILED,
        );

        this.logger.error(`[EXECUTOR] Reverse 2단계 실패: ${session.id}`);
      }
    } catch (error) {
      this.logger.error(
        `[EXECUTOR] Reverse 2단계 처리 중 오류: ${error.message}`,
      );
      session.status = SessionStatus.FAILED;
      this.sessionStateService.updateSessionStatus(
        session.id,
        SessionStatus.FAILED,
      );
    }
  }

  private async handleIdleSession(session: ISession): Promise<void> {
    this.logger.log(`[EXECUTOR] IDLE 세션 ${session.id} 처리 시작`);

    // 모든 심볼에 대해 고프리미엄 기회 탐색
    const watchedSymbols = this.priceFeedService.getWatchedSymbols();

    for (const symbolConfig of watchedSymbols) {
      const marketState = this.spreadCalculatorService.getMarketState(
        symbolConfig.symbol,
      );

      if (!marketState) {
        continue;
      }
      // 시장 상태에 따른 기회 탐색
      if (marketState.marketState === 'NORMAL') {
        const normalOpportunity = await this.checkHighPremiumOpportunity(
          symbolConfig.symbol,
        );

        if (normalOpportunity) {
          session.marketDirection = 'NORMAL';
          session.strategyType = 'HIGH_PREMIUM_FIRST';
          session.highPremiumData = {
            symbol: normalOpportunity.symbol, // ✅ 수정
            investmentKRW: normalOpportunity.investmentKRW,
            investmentUSDT: normalOpportunity.investmentUSDT,
            expectedProfit: normalOpportunity.netProfit,
            upbitPrice: normalOpportunity.upbitPrice,
            binancePrice: normalOpportunity.binancePrice,
            rate: normalOpportunity.rate,
            executedAt: new Date(),
          };

          session.status = SessionStatus.NORMAL_PROCESSING;
          this.sessionStateService.updateSessionStatus(
            session.id,
            SessionStatus.NORMAL_PROCESSING,
          );

          // 고프리미엄 처리 실행
          await this.executeNormalStrategy(session);
          break; // 하나의 기회만 처리
        }
      } else if (marketState.marketState === 'REVERSE') {
        // Reverse 기회 탐색 (투자 금액 필요)
        const latestPortfolio =
          await this.portfolioLogService.getLatestPortfolio();
        const currentTotalCapitalKrw =
          latestPortfolio?.total_balance_krw ||
          this.investmentConfigService.getInvestmentConfig().initialCapitalKrw;
        const investmentKRW =
          this.investmentConfigService.calculateInvestmentAmount(
            currentTotalCapitalKrw,
          );
        const reverseOpportunity =
          await this.spreadCalculatorService.checkReverseOpportunity(
            symbolConfig.symbol,
            investmentKRW,
          );

        if (reverseOpportunity) {
          // Reverse 전략 설정
          session.marketDirection = 'REVERSE';
          session.strategyType = 'LOW_PREMIUM_FIRST';
          session.lowPremiumData = {
            requiredProfit: 0,
            allowedLoss: Math.abs(reverseOpportunity.expectedLoss), // ✅ 수정
            searchStartTime: new Date(),
            targetSymbol: reverseOpportunity.symbol, // ✅ 수정
          };

          session.status = SessionStatus.REVERSE_PROCESSING;
          this.sessionStateService.updateSessionStatus(
            session.id,
            SessionStatus.REVERSE_PROCESSING,
          );

          await this.executeReverseStrategy(session, reverseOpportunity); // ✅ 수정
          break;
        }
      }
    }
  }

  async executeHighPremiumOpportunity(
    session: ISession,
    opportunity: any,
  ): Promise<void> {
    this.logger.log(
      `[EXECUTOR] 실시간 고프리미엄 기회 실행: ${session.id} - ${opportunity.symbol}`,
    );

    // 세션에 고프리미엄 데이터 설정
    session.highPremiumData = {
      symbol: opportunity.symbol,
      investmentKRW: opportunity.investmentKRW,
      investmentUSDT: opportunity.investmentUSDT,
      expectedProfit: opportunity.netProfit,
      upbitPrice: opportunity.upbitPrice,
      binancePrice: opportunity.binancePrice,
      rate: opportunity.rate,
      executedAt: new Date(),
    };

    session.status = SessionStatus.HIGH_PREMIUM_PROCESSING;
    this.sessionStateService.updateSessionStatus(
      session.id,
      SessionStatus.HIGH_PREMIUM_PROCESSING,
    );

    // 고프리미엄 처리 실행
    await this.executeHighPremiumProcessing(session, opportunity);
  }

  private async handleLowPremiumSession(session: ISession): Promise<void> {
    this.logger.log(`[EXECUTOR] 저프리미엄 세션 ${session.id} 처리 시작`);

    if (!session.lowPremiumData || !session.highPremiumData) {
      this.logger.error(
        `[EXECUTOR] 세션 ${session.id}에 필요한 데이터가 없습니다.`,
      );
      return;
    }

    // 저프리미엄 처리 실행
    const result: LowPremiumResult | null =
      await this.lowPremiumProcessorService.processLowPremiumOpportunity();

    if (result && result.cycleId) {
      this.logger.log(
        `[EXECUTOR] 저프리미엄 처리 완료: ${result.cycleId} (성공: ${result.success})`,
      );

      const cycleData = await this.arbitrageRecordService.getArbitrageCycle(
        result.cycleId,
      );
      if (cycleData) {
        // HP_ONLY_COMPLETED_TARGET_MISSED는 부분 성공으로 간주
        if (cycleData.status === 'HP_ONLY_COMPLETED_TARGET_MISSED') {
          this.logger.log(
            `[EXECUTOR] 고프리미엄 성공, 저프리미엄 기회 없음. 세션을 COMPLETED로 처리: ${session.id}`,
          );
          session.status = SessionStatus.COMPLETED;
          this.sessionStateService.updateSessionStatus(
            session.id,
            SessionStatus.COMPLETED,
          );

          // 자금 상태 업데이트 (고프리미엄 수익이 있으므로)
          await this.sessionFundValidationService.validateSessionFunds();
          this.logger.log(
            `[EXECUTOR] 부분 성공 세션 완료로 자금 상태 업데이트 완료`,
          );

          return;
        }
      }
      // 세션 완료 처리
      const success = result.success;
      session.status = success ? SessionStatus.COMPLETED : SessionStatus.FAILED;
      this.sessionStateService.updateSessionStatus(session.id, session.status);

      // �� 세션 완료 시 자금 상태 업데이트
      if (success) {
        await this.sessionFundValidationService.validateSessionFunds();
        this.logger.log(`[EXECUTOR] 세션 완료로 자금 상태 업데이트 완료`);
      }
    } else {
      this.logger.debug(`[EXECUTOR] 저프리미엄 처리 결과가 없습니다.`);
    }
  }

  private async checkHighPremiumOpportunity(symbol: string): Promise<any> {
    const upbitPrice = this.priceFeedService.getUpbitPrice(symbol);
    const binancePrice = this.priceFeedService.getBinancePrice(symbol);

    // 가격 데이터 검증 강화
    if (upbitPrice === undefined || binancePrice === undefined) {
      this.logger.debug(
        `[EXECUTOR] 가격 데이터 없음: ${symbol} (업비트: ${upbitPrice}, 바이낸스: ${binancePrice})`,
      );
      return null;
    }

    // 추가 검증: 가격이 유효한 숫자인지 확인
    if (
      isNaN(upbitPrice) ||
      isNaN(binancePrice) ||
      upbitPrice <= 0 ||
      binancePrice <= 0
    ) {
      this.logger.debug(
        `[EXECUTOR] 유효하지 않은 가격: ${symbol} (업비트: ${upbitPrice}, 바이낸스: ${binancePrice})`,
      );
      return null;
    }

    // 중앙화된 설정 서비스 사용
    const latestPortfolio = await this.portfolioLogService.getLatestPortfolio();
    const currentTotalCapitalKrw =
      latestPortfolio?.total_balance_krw ||
      this.investmentConfigService.getInvestmentConfig().initialCapitalKrw;

    const investmentKRW =
      this.investmentConfigService.calculateInvestmentAmount(
        currentTotalCapitalKrw,
      );

    const rate = this.exchangeService.getUSDTtoKRW();

    if (rate === 0) {
      this.logger.warn('[EXECUTOR] 환율이 0입니다. 기회 확인을 건너뜁니다.');
      return null;
    }

    const investmentUSDT = investmentKRW / rate;

    const upbitVolume24h = this.priceFeedService.getUpbitVolume(symbol);

    const opportunity = await this.spreadCalculatorService.calculateSpread({
      symbol,
      upbitPrice,
      binancePrice,
      investmentUSDT,
      upbitVolume24h,
    });

    if (opportunity) {
      // opportunity 객체의 모든 필수 필드가 유효한지 확인
      if (
        !opportunity.symbol ||
        !this.isValidNumber(opportunity.upbitPrice) ||
        !this.isValidNumber(opportunity.binancePrice) ||
        !this.isValidNumber(opportunity.rate)
      ) {
        this.logger.warn(`[EXECUTOR] 유효하지 않은 기회 데이터: ${symbol}`);
        return null;
      }
    }

    return opportunity;
  }

  private isValidNumber(value: any): boolean {
    return (
      typeof value === 'number' && !isNaN(value) && isFinite(value) && value > 0
    );
  }

  private async executeHighPremiumProcessing(
    session: ISession,
    opportunity: any,
  ): Promise<void> {
    this.logger.log(
      `[EXECUTOR] 고프리미엄 처리 시작: ${session.id} - ${opportunity.symbol}`,
    );

    try {
      const hpResult =
        await this.highPremiumProcessorService.processHighPremiumOpportunity(
          opportunity,
        );

      if (
        hpResult.success &&
        hpResult.nextStep === 'awaitLowPremium' &&
        hpResult.cycleId
      ) {
        // 고프리미엄 성공, 저프리미엄 대기 상태로 전환
        session.cycleId = hpResult.cycleId;
        session.lowPremiumData = {
          requiredProfit: opportunity.netProfit,
          allowedLoss: opportunity.netProfit * 0.5, // 허용 손실은 수익의 50%
          searchStartTime: new Date(),
        };

        session.status = SessionStatus.AWAITING_LOW_PREMIUM;
        this.sessionStateService.updateSessionStatus(
          session.id,
          SessionStatus.AWAITING_LOW_PREMIUM,
        );

        this.logger.log(
          `[EXECUTOR] 고프리미엄 처리 성공. 저프리미엄 대기 상태로 전환: ${session.id}`,
        );
      } else {
        // 고프리미엄 실패
        session.status = SessionStatus.FAILED;
        this.sessionStateService.updateSessionStatus(
          session.id,
          SessionStatus.FAILED,
        );

        this.logger.error(`[EXECUTOR] 고프리미엄 처리 실패: ${session.id}`);
      }
    } catch (error) {
      this.logger.error(`[EXECUTOR] 고프리미엄 처리 중 오류: ${error.message}`);
      session.status = SessionStatus.FAILED;
      this.sessionStateService.updateSessionStatus(
        session.id,
        SessionStatus.FAILED,
      );
    }
  }
  // 세션별 독립적인 저프리미엄 처리 (새로 추가)
  async processLowPremiumForSession(session: ISession): Promise<void> {
    this.logger.log(`[EXECUTOR] 세션별 LP 탐색 시작: ${session.id}`);

    if (!session.highPremiumData) {
      this.logger.error(
        `[EXECUTOR] 세션 ${session.id}에 고프리미엄 데이터가 없습니다.`,
      );
      return;
    }

    // 세션의 고프리미엄 데이터에서 필요한 정보 추출
    const highPremiumProfit = session.highPremiumData.expectedProfit;
    const highPremiumSymbol = session.highPremiumData.symbol;
    const investmentKRW = session.highPremiumData.investmentKRW;
    // 허용 손실 계산 (고프리미엄 수익의 80%까지 허용)
    const allowedLossKrw = highPremiumProfit * 0.8;

    this.logger.log(`[EXECUTOR] 세션 ${session.id} LP 탐색 조건:`);
    this.logger.log(` - 고프리미엄 수익: ${highPremiumProfit.toFixed(0)} KRW`);
    this.logger.log(` - 허용 손실: ${allowedLossKrw.toFixed(0)} KRW`);
    this.logger.log(` - 제외 코인: ${highPremiumSymbol.toUpperCase()}`);

    // 저프리미엄 기회 탐색
    const opportunity = await this.findLowPremiumOpportunity(
      highPremiumSymbol,
      allowedLossKrw,
      investmentKRW,
    );

    if (opportunity) {
      this.logger.log(
        `[EXECUTOR] 세션 ${session.id}에서 LP 기회 발견: ${opportunity.symbol.toUpperCase()}`,
      );

      // 세션 상태를 LP 처리 중으로 변경
      session.status = SessionStatus.LOW_PREMIUM_PROCESSING;
      this.sessionStateService.updateSessionStatus(
        session.id,
        SessionStatus.LOW_PREMIUM_PROCESSING,
      );

      // LP 처리 실행
      await this.executeLowPremiumProcessing(session, opportunity);
    } else {
      this.logger.debug(
        `[EXECUTOR] 세션 ${session.id}에서 적절한 LP 기회를 찾지 못했습니다.`,
      );
    }
  }

  // 저프리미엄 기회 탐색 (세션별 독립)
  private async findLowPremiumOpportunity(
    excludeSymbol: string,
    allowedLossKrw: number,
    investmentKRW: number,
  ): Promise<any> {
    const watchedSymbols = this.priceFeedService.getWatchedSymbols();
    let bestOpportunity: any = null;
    let bestLossKrw = allowedLossKrw;

    for (const symbolConfig of watchedSymbols) {
      // 고프리미엄 코인은 제외
      if (symbolConfig.symbol === excludeSymbol) {
        continue;
      }

      const upbitPrice = this.priceFeedService.getUpbitPrice(
        symbolConfig.symbol,
      );
      const binancePrice = this.priceFeedService.getBinancePrice(
        symbolConfig.symbol,
      );

      if (!upbitPrice || !binancePrice) {
        continue;
      }

      // 유동성 필터링
      try {
        const upbitVolume24h = this.priceFeedService.getUpbitVolume(
          symbolConfig.symbol,
        );
        if (upbitVolume24h < 5000000000) {
          // 50억원 미만 제외
          continue;
        }
      } catch (error) {
        this.logger.error(`[EXECUTOR] 유동성 필터링 중 오류: ${error.message}`);
        continue;
      }
      // 슬리피지 계산
      let slippagePercent = 0;
      try {
        const upbitOrderBook = this.priceFeedService.getUpbitOrderBook(
          symbolConfig.symbol,
        );
        if (upbitOrderBook) {
          const slippageResult = this.slippageCalculatorService.calculate(
            upbitOrderBook,
            'buy',
            investmentKRW,
          );
          slippagePercent = slippageResult.slippagePercent;
          if (slippagePercent > 1) {
            continue;
          }
        }
      } catch (error) {
        this.logger.error(`[EXECUTOR] 슬리피지 계산 중 오류: ${error.message}`);
        continue;
      }

      // 수수료 계산
      const amount = investmentKRW / upbitPrice;
      const rate = this.exchangeService.getUSDTtoKRW();

      if (rate === 0) {
        continue;
      }

      const feeResult = this.feeCalculatorService.calculate({
        symbol: symbolConfig.symbol,
        amount,
        upbitPrice,
        binancePrice,
        rate,
        tradeDirection: 'LOW_PREMIUM_SELL_BINANCE',
      });
      // 최종 예상 손실 계산
      const finalExpectedProfitPercent =
        feeResult.netProfitPercent - slippagePercent;
      const finalExpectedProfitKrw =
        feeResult.netProfit - (investmentKRW * slippagePercent) / 100;
      const expectedLossKrw = Math.abs(finalExpectedProfitKrw);

      // 허용 손실 범위 내에서 최적 기회 선택
      if (expectedLossKrw <= allowedLossKrw && expectedLossKrw < bestLossKrw) {
        bestOpportunity = {
          symbol: symbolConfig.symbol,
          upbitPrice,
          binancePrice,
          expectedLossKrw,
          expectedLossPercent: Math.abs(finalExpectedProfitPercent),
          rate,
          investmentKRW,
        };
        bestLossKrw = expectedLossKrw;
      }
    }

    return bestOpportunity;
  }

  // 저프리미엄 처리 실행 (세션별 독립)
  private async executeLowPremiumProcessing(
    session: ISession,
    opportunity: any,
  ): Promise<void> {
    this.logger.log(
      `[EXECUTOR] 세션 ${session.id} LP 처리 시작: ${opportunity.symbol.toUpperCase()}`,
    );

    try {
      // LP 거래 실행
      await this.strategyLowService.handleLowPremiumFlow(
        opportunity.symbol,
        opportunity.upbitPrice,
        opportunity.binancePrice,
        opportunity.rate,
        session.cycleId || `session_${session.id}`,
        opportunity.investmentKRW,
      );

      // 세션 완료 처리
      session.status = SessionStatus.COMPLETED;
      this.sessionStateService.updateSessionStatus(
        session.id,
        SessionStatus.COMPLETED,
      );

      this.logger.log(`[EXECUTOR] 세션 ${session.id} LP 처리 완료`);

      // 자금 상태 업데이트
      await this.sessionFundValidationService.validateSessionFunds();
    } catch (error) {
      this.logger.error(
        `[EXECUTOR] 세션 ${session.id} LP 처리 중 오류: ${error.message}`,
      );

      // 에러 타입에 따른 처리
      const errorMessage = error.message.toLowerCase();

      // 송금 후 에러인지 확인 (StrategyLowService에서 이미 처리됨)
      if (
        errorMessage.includes('after withdrawal') ||
        errorMessage.includes('송금 후')
      ) {
        // 송금 후 에러: 세션 실패 처리
        session.status = SessionStatus.FAILED;
        this.sessionStateService.updateSessionStatus(
          session.id,
          SessionStatus.FAILED,
        );
      } else {
        // 송금 전 에러: 세션을 AWAITING_LP로 유지하여 재탐색 가능하게 함
        session.status = SessionStatus.AWAITING_LOW_PREMIUM;
        this.sessionStateService.updateSessionStatus(
          session.id,
          SessionStatus.AWAITING_LOW_PREMIUM,
        );

        this.logger.log(
          `[EXECUTOR] 세션 ${session.id} 송금 전 에러로 재탐색 가능 상태로 유지`,
        );
      }
    }
  }
  // 새로운 메서드 추가: Reverse 전략 실행
  async executeReverseOpportunity(
    session: ISession,
    opportunity: any,
  ): Promise<void> {
    this.logger.log(
      `[EXECUTOR] Reverse 전략 실행: ${session.id} - ${opportunity.symbol}`,
    );

    // 세션에 Reverse 전략 데이터 설정
    session.lowPremiumData = {
      requiredProfit: 0, // Reverse에서는 1단계에서 수익을 확보
      allowedLoss: Math.abs(opportunity.expectedLoss), // 예상 손실을 허용 손실로 설정
      searchStartTime: new Date(),
      targetSymbol: opportunity.symbol,
    };

    session.status = SessionStatus.REVERSE_PROCESSING;
    this.sessionStateService.updateSessionStatus(
      session.id,
      SessionStatus.REVERSE_PROCESSING,
    );

    // Reverse 전략 실행 (저프리미엄 → 고프리미엄)
    await this.executeReverseStrategy(session, opportunity);
  }
  // 새로운 메서드 추가: Normal 전략 실행
  async executeNormalStrategy(session: ISession): Promise<void> {
    this.logger.log(`[EXECUTOR] Normal 전략 실행: ${session.id}`);

    if (!session.highPremiumData) {
      this.logger.error(
        `[EXECUTOR] 세션 ${session.id}에 고프리미엄 데이터가 없습니다.`,
      );
      session.status = SessionStatus.FAILED;
      this.sessionStateService.updateSessionStatus(
        session.id,
        SessionStatus.FAILED,
      );
      return;
    }

    // 1단계: 고프리미엄 실행
    const opportunity = {
      symbol: session.highPremiumData.symbol,
      upbitPrice: session.highPremiumData.upbitPrice,
      binancePrice: session.highPremiumData.binancePrice,
      rate: session.highPremiumData.rate,
      netProfit: session.highPremiumData.expectedProfit,
      netProfitPercent:
        (session.highPremiumData.expectedProfit /
          session.highPremiumData.investmentKRW) *
        100,
      investmentKRW: session.highPremiumData.investmentKRW,
      investmentUSDT: session.highPremiumData.investmentUSDT,
    };

    await this.executeHighPremiumProcessing(session, opportunity);
  }
  // 새로운 메서드 추가: Reverse 전략 실행
  async executeReverseStrategy(
    session: ISession,
    opportunity: any,
  ): Promise<void> {
    this.logger.log(
      `[EXECUTOR] Reverse 전략 실행: ${session.id} - ${opportunity.symbol}`,
    );

    try {
      // 1단계: 저프리미엄 실행
      const lpResult = await this.executeLowPremiumStep(session, opportunity);

      if (lpResult && lpResult.success) {
        // 2단계: 고프리미엄 대기 상태로 전환
        session.status = SessionStatus.AWAITING_SECOND_STEP;
        this.sessionStateService.updateSessionStatus(
          session.id,
          SessionStatus.AWAITING_SECOND_STEP,
        );

        this.logger.log(
          `[EXECUTOR] Reverse 1단계(저프리미엄) 성공. 2단계(고프리미엄) 대기 상태로 전환: ${session.id}`,
        );
      } else {
        // 저프리미엄 실패
        session.status = SessionStatus.FAILED;
        this.sessionStateService.updateSessionStatus(
          session.id,
          SessionStatus.FAILED,
        );
        this.logger.error(
          `[EXECUTOR] Reverse 1단계(저프리미엄) 실패: ${session.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[EXECUTOR] Reverse 전략 실행 중 오류: ${error.message}`,
      );
      session.status = SessionStatus.FAILED;
      this.sessionStateService.updateSessionStatus(
        session.id,
        SessionStatus.FAILED,
      );
    }
  }

  // 새로운 메서드 추가: 저프리미엄 1단계 실행
  private async executeLowPremiumStep(
    session: ISession,
    opportunity: any,
  ): Promise<any> {
    this.logger.log(
      `[EXECUTOR] Reverse 1단계(저프리미엄) 실행: ${session.id} - ${opportunity.symbol}`,
    );

    try {
      // Reverse 전략용 사이클 생성
      if (!session.cycleId) {
        const cycleData = {
          marketDirection: 'REVERSE' as const,
          strategyType: 'LOW_PREMIUM_FIRST' as const,
          status: 'STARTED' as const,
          startTime: new Date(),
        };

        const newCycle =
          await this.arbitrageRecordService.createArbitrageCycle(cycleData);
        session.cycleId = newCycle.id;
        this.sessionStateService.updateSessionData(session.id, {
          cycleId: newCycle.id,
        });

        this.logger.log(
          `[EXECUTOR] Reverse 전략용 사이클 생성: ${newCycle.id}`,
        );
      }

      // 🔥 추가: investmentKRW 설정
      const investmentKRW =
        this.investmentConfigService.calculateInvestmentAmount(
          await this.portfolioManagerService.getCurrentInvestmentAmount(),
        );

      const safeInvestmentKRW = Number(investmentKRW);

      // opportunity에 investmentKRW 추가
      const enhancedOpportunity = {
        ...opportunity,
        investmentKRW: safeInvestmentKRW,
      };

      this.logger.log(
        `[EXECUTOR] Reverse 전략 투자금 설정: ${safeInvestmentKRW.toFixed(0)} KRW`, // ← 수정된 부분
      );

      // 저프리미엄 처리 실행
      const result = await this.strategyLowService.handleLowPremiumFlow(
        opportunity.symbol,
        opportunity.upbitPrice,
        opportunity.binancePrice,
        opportunity.rate,
        session.cycleId,
        enhancedOpportunity.investmentKRW,
      );

      if (result && result.success) {
        this.logger.log(
          `[EXECUTOR] Reverse 1단계(저프리미엄) 성공: ${session.id}`,
        );
        return { success: true };
      } else {
        this.logger.error(
          `[EXECUTOR] Reverse 1단계(저프리미엄) 실패: ${session.id} - ${result?.error || 'Unknown error'}`,
        );
        return { success: false, error: result?.error || 'Unknown error' };
      }
    } catch (error) {
      this.logger.error(
        `[EXECUTOR] Reverse 1단계 실행 중 오류: ${error.message}`,
      );
      throw error;
    }
  }

  // 새로운 메서드 추가: 고프리미엄 2단계 실행 (Reverse 전략용)
  private async executeHighPremiumStep(session: ISession): Promise<any> {
    this.logger.log(`[EXECUTOR] Reverse 2단계(고프리미엄) 실행: ${session.id}`);

    try {
      // 고프리미엄 기회 탐색
      const opportunity =
        await this.findHighPremiumOpportunityForReverse(session);

      if (opportunity) {
        // 고프리미엄 처리 실행
        const result =
          await this.highPremiumProcessorService.processHighPremiumOpportunity(
            opportunity,
          );
        return result;
      } else {
        this.logger.warn(
          `[EXECUTOR] Reverse 2단계에서 고프리미엄 기회를 찾지 못함: ${session.id}`,
        );
        return null;
      }
    } catch (error) {
      this.logger.error(
        `[EXECUTOR] Reverse 2단계 실행 중 오류: ${error.message}`,
      );
      throw error;
    }
  }

  // 새로운 메서드 추가: Reverse 전략용 고프리미엄 기회 탐색
  private async findHighPremiumOpportunityForReverse(
    session: ISession,
  ): Promise<any> {
    this.logger.log(
      `[EXECUTOR] Reverse 2단계용 고프리미엄 기회 탐색: ${session.id}`,
    );

    const watchedSymbols = this.priceFeedService.getWatchedSymbols();
    const allowedLossKrw = session.lowPremiumData?.allowedLoss || 0;

    for (const symbolConfig of watchedSymbols) {
      const symbol = symbolConfig.symbol;

      // 시장 상태 확인 (고프리미엄 기회가 있는지)
      const marketState = this.spreadCalculatorService.getMarketState(symbol);

      if (marketState?.marketState !== 'NORMAL') {
        continue; // 고프리미엄 기회가 없음
      }

      // 고프리미엄 기회 확인
      const opportunity = await this.checkHighPremiumOpportunity(symbol);

      if (opportunity) {
        // 허용 손실 범위 내에서 수익이 나는지 확인
        const expectedProfit = opportunity.netProfit;

        if (expectedProfit >= allowedLossKrw) {
          this.logger.log(
            `[EXECUTOR] Reverse 2단계용 고프리미엄 기회 발견: ${symbol.toUpperCase()}`,
          );
          return opportunity;
        }
      }
    }

    return null;
  }
}
