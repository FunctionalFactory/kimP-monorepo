import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ISession, SessionStatus } from './interfaces/session.interface';
import { SessionStateService } from './session-state.service';
import { SessionExecutorService } from './session-executor.service';
import { ArbitrageFlowManagerService } from '../arbitrage/arbitrage-flow-manager.service';
import { PriceFeedService } from '../marketdata/price-feed.service';
import { SpreadCalculatorService } from '../common/spread-calculator.service';
import { PortfolioLogService } from '../db/portfolio-log.service';
import { ExchangeService } from '../common/exchange.service';
import { ConfigService } from '@nestjs/config';
import { SessionFundValidationService } from 'src/db/session-fund-validation.service';
import { InvestmentConfigService } from 'src/config/investment-config.service';
import { LoggingService } from '../common/logging.service';
import { PortfolioManagerService } from 'src/common/portfolio-manager.service';

@Injectable()
export class SessionManagerService implements OnModuleInit {
  private readonly logger = new Logger(SessionManagerService.name);

  constructor(
    private readonly sessionStateService: SessionStateService,
    private readonly sessionExecutorService: SessionExecutorService,
    private readonly arbitrageFlowManagerService: ArbitrageFlowManagerService,
    private readonly priceFeedService: PriceFeedService,
    private readonly spreadCalculatorService: SpreadCalculatorService,
    private readonly portfolioLogService: PortfolioLogService,
    private readonly exchangeService: ExchangeService,
    private readonly configService: ConfigService,
    private readonly sessionFundValidationService: SessionFundValidationService, // 추가
    private readonly investmentConfigService: InvestmentConfigService,
    private readonly loggingService: LoggingService, // 추가
    private readonly portfolioManagerService: PortfolioManagerService,
  ) {}

  onModuleInit() {
    this.loggingService.info('세션 기반 병렬 처리 시스템 초기화 완료', {
      service: 'SESSION_MANAGER',
    });
  }

  // 실시간 가격 업데이트 처리 (WsService에서 호출)
  async handlePriceUpdate(symbol: string): Promise<void> {
    // 🔥 추가: 단일 사이클 테스트 모드에서는 실시간 기회 탐색 비활성화
    const singleCycleTest =
      this.configService.get('SINGLE_CYCLE_TEST') === 'true';
    if (singleCycleTest) {
      return;
    }

    // this.logger.debug(`[SESSION_MANAGER] 실시간 가격 업데이트 처리: ${symbol}`);
    const activeSessions = this.sessionStateService.getActiveSessions();
    const processingSessions = activeSessions.filter(
      (session) =>
        session.status === SessionStatus.NORMAL_PROCESSING ||
        session.status === SessionStatus.REVERSE_PROCESSING ||
        session.status === SessionStatus.HIGH_PREMIUM_PROCESSING ||
        session.status === SessionStatus.LOW_PREMIUM_PROCESSING,
    );

    if (processingSessions.length > 0) {
      this.logger.debug(
        `[SESSION_MANAGER] 이미 처리 중인 세션이 있어서 새로운 기회를 건너뜁니다: ${processingSessions.length}개 세션 진행 중`,
      );
      return;
    }

    // 실시간 고프리미엄 기회 확인
    const opportunity = await this.checkHighPremiumOpportunity(symbol);

    if (opportunity) {
      // IDLE 세션이 있으면 해당 세션에서 처리
      const idleSessions = this.sessionStateService.getSessionsByStatus(
        SessionStatus.IDLE,
      );

      if (idleSessions.length > 0) {
        // 첫 번째 IDLE 세션에서 처리
        const session = idleSessions[0];
        await this.sessionExecutorService.executeHighPremiumOpportunity(
          session,
          opportunity,
        );
        this.logger.log(
          `[SESSION_MANAGER] 실시간 기회를 IDLE 세션에서 처리: ${session.id} - ${opportunity.symbol}`,
        );
      } else {
        // 새 세션 생성
        const session = await this.createHighPremiumSession(opportunity);
        if (session) {
          this.logger.log(
            `[SESSION_MANAGER] 실시간 기회 발견으로 새 세션 생성: ${session.id} - ${opportunity.symbol}`,
          );
          await this.sessionExecutorService.executeHighPremiumOpportunity(
            session,
            opportunity,
          );
        } else {
          this.logger.debug(
            `[SESSION_MANAGER] 자금 부족으로 세션 생성 건너뜀: ${opportunity.symbol}`,
          );
        }
      }
    }
  }

  // // 고프리미엄 기회 발견 시 새 세션 생성
  // async createHighPremiumSession(opportunityData: any): Promise<ISession> {
  //   this.loggingService.info('고프리미엄 세션 생성 시작', {
  //     service: 'SESSION_MANAGER',
  //     method: 'createHighPremiumSession',
  //     symbol: opportunityData.symbol,
  //   });

  //   const latestValidation =
  //     await this.sessionFundValidationService.getLatestValidationResult();

  //   let isFundSufficient = false;

  //   if (latestValidation && latestValidation.isFundSufficient) {
  //     // DB에 충분한 자금이 있다고 기록되어 있으면 통과
  //     isFundSufficient = true;
  //     this.loggingService.debug('DB 기반 자금 검증 통과', {
  //       service: 'SESSION_MANAGER',
  //       method: 'createHighPremiumSession',
  //       data: {
  //         actualBalance: latestValidation.actualBinanceBalanceKrw,
  //       },
  //     });
  //   } else {
  //     // DB에 기록이 없거나 자금이 부족하면 실제 검증 수행
  //     this.loggingService.info('실제 자금 검증 수행', {
  //       service: 'SESSION_MANAGER',
  //       method: 'createHighPremiumSession',
  //     });
  //     isFundSufficient =
  //       await this.sessionFundValidationService.validateSessionFunds();
  //   }

  //   if (!isFundSufficient) {
  //     this.loggingService.warn('자금 부족으로 세션 생성 실패', {
  //       service: 'SESSION_MANAGER',
  //       method: 'createHighPremiumSession',
  //       symbol: opportunityData.symbol,
  //     });
  //     return null;
  //   }

  //   const session = this.sessionStateService.createSession();

  //   // 세션에 고프리미엄 데이터 설정
  //   session.highPremiumData = {
  //     symbol: opportunityData.symbol,
  //     investmentKRW: opportunityData.investmentKRW,
  //     investmentUSDT: opportunityData.investmentUSDT,
  //     expectedProfit: opportunityData.expectedProfit,
  //     upbitPrice: opportunityData.upbitPrice, // 추가
  //     binancePrice: opportunityData.binancePrice, // 추가
  //     rate: opportunityData.rate, // 추가
  //     executedAt: new Date(),
  //   };

  //   session.status = SessionStatus.HIGH_PREMIUM_PROCESSING;

  //   this.loggingService.info('고프리미엄 세션 생성 완료', {
  //     service: 'SESSION_MANAGER',
  //     method: 'createHighPremiumSession',
  //     sessionId: session.id,
  //     symbol: opportunityData.symbol,
  //   });
  //   return session;
  // }

  // 새로운 메서드 추가: Normal 세션 생성 (고프리미엄 → 저프리미엄)
  async createNormalSession(opportunityData: any): Promise<ISession> {
    this.loggingService.info('Normal 세션 생성 시작', {
      service: 'SESSION_MANAGER',
      method: 'createNormalSession',
      symbol: opportunityData.symbol,
    });

    const latestValidation =
      await this.sessionFundValidationService.getLatestValidationResult();

    let isFundSufficient = false;

    if (latestValidation && latestValidation.isFundSufficient) {
      isFundSufficient = true;
      this.loggingService.debug('DB 기반 자금 검증 통과', {
        service: 'SESSION_MANAGER',
        method: 'createNormalSession',
        data: {
          actualBalance: latestValidation.actualBinanceBalanceKrw,
        },
      });
    } else {
      this.loggingService.info('실제 자금 검증 수행', {
        service: 'SESSION_MANAGER',
        method: 'createNormalSession',
      });
      isFundSufficient =
        await this.sessionFundValidationService.validateSessionFunds();
    }

    if (!isFundSufficient) {
      this.loggingService.warn('자금 부족으로 Normal 세션 생성 실패', {
        service: 'SESSION_MANAGER',
        method: 'createNormalSession',
        symbol: opportunityData.symbol,
      });
      return null;
    }

    const session = this.sessionStateService.createSession();

    // 세션에 Normal 전략 데이터 설정
    session.marketDirection = 'NORMAL';
    session.strategyType = 'HIGH_PREMIUM_FIRST';
    session.highPremiumData = {
      symbol: opportunityData.symbol,
      investmentKRW: opportunityData.investmentKRW,
      investmentUSDT: opportunityData.investmentUSDT,
      expectedProfit: opportunityData.expectedProfit,
      upbitPrice: opportunityData.upbitPrice,
      binancePrice: opportunityData.binancePrice,
      rate: opportunityData.rate,
      executedAt: new Date(),
    };

    session.status = SessionStatus.NORMAL_PROCESSING;

    this.loggingService.info('Normal 세션 생성 완료', {
      service: 'SESSION_MANAGER',
      method: 'createNormalSession',
      sessionId: session.id,
      symbol: opportunityData.symbol,
    });
    return session;
  }

  // 새로운 메서드 추가: Reverse 세션 생성 (저프리미엄 → 고프리미엄)
  async createReverseSession(opportunityData: any): Promise<ISession> {
    this.loggingService.info('Reverse 세션 생성 시작', {
      service: 'SESSION_MANAGER',
      method: 'createReverseSession',
      symbol: opportunityData.symbol,
    });

    const latestValidation =
      await this.sessionFundValidationService.getLatestValidationResult();

    let isFundSufficient = false;

    if (latestValidation && latestValidation.isFundSufficient) {
      isFundSufficient = true;
      this.loggingService.debug('DB 기반 자금 검증 통과', {
        service: 'SESSION_MANAGER',
        method: 'createReverseSession',
        data: {
          actualBalance: latestValidation.actualBinanceBalanceKrw,
        },
      });
    } else {
      this.loggingService.info('실제 자금 검증 수행', {
        service: 'SESSION_MANAGER',
        method: 'createReverseSession',
      });
      isFundSufficient =
        await this.sessionFundValidationService.validateSessionFunds();
    }

    if (!isFundSufficient) {
      this.loggingService.warn('자금 부족으로 Reverse 세션 생성 실패', {
        service: 'SESSION_MANAGER',
        method: 'createReverseSession',
        symbol: opportunityData.symbol,
      });
      return null;
    }

    const session = this.sessionStateService.createSession();

    // 세션에 Reverse 전략 데이터 설정
    session.marketDirection = 'REVERSE';
    session.strategyType = 'LOW_PREMIUM_FIRST';
    session.lowPremiumData = {
      requiredProfit: 0, // Reverse에서는 1단계에서 수익을 확보
      allowedLoss: Math.abs(opportunityData.expectedLoss), // 예상 손실을 허용 손실로 설정
      searchStartTime: new Date(),
      targetSymbol: opportunityData.symbol,
    };

    session.status = SessionStatus.REVERSE_PROCESSING;

    this.loggingService.info('Reverse 세션 생성 완료', {
      service: 'SESSION_MANAGER',
      method: 'createReverseSession',
      sessionId: session.id,
      symbol: opportunityData.symbol,
    });
    return session;
  }

  // 기존 createHighPremiumSession 메서드를 createNormalSession으로 리팩토링
  async createHighPremiumSession(opportunityData: any): Promise<ISession> {
    // 기존 로직을 createNormalSession으로 위임
    return this.createNormalSession(opportunityData);
  }

  // 주기적으로 다음 세션 처리
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processSessions() {
    await this.sessionExecutorService.processNextSession();
  }

  // // 고프리미엄 기회 탐색 및 새 세션 생성
  // @Cron(CronExpression.EVERY_30_SECONDS)
  // async scanForHighPremiumOpportunities() {
  //   const idleSessions = this.sessionStateService.getSessionsByStatus(
  //     SessionStatus.IDLE,
  //   );

  //   // IDLE 세션이 있으면 기존 세션에서 처리
  //   if (idleSessions.length > 0) {
  //     this.loggingService.debug('IDLE 세션이 있어 새 세션 생성을 건너뜀', {
  //       service: 'SESSION_MANAGER',
  //       method: 'scanForHighPremiumOpportunities',
  //       data: { idleSessionCount: idleSessions.length },
  //     });
  //     return;
  //   }

  //   // IDLE 세션이 없으면 새 세션 생성
  //   const watchedSymbols = this.priceFeedService.getWatchedSymbols();

  //   for (const symbolConfig of watchedSymbols) {
  //     const opportunity = await this.checkHighPremiumOpportunity(
  //       symbolConfig.symbol,
  //     );

  //     if (opportunity) {
  //       const session = await this.createHighPremiumSession(opportunity);
  //       if (session) {
  //         this.loggingService.info('고프리미엄 기회 발견으로 새 세션 생성', {
  //           service: 'SESSION_MANAGER',
  //           method: 'scanForHighPremiumOpportunities',
  //           sessionId: session.id,
  //           symbol: opportunity.symbol,
  //         });

  //         await this.sessionExecutorService.executeHighPremiumOpportunity(
  //           session,
  //           opportunity,
  //         );
  //         this.loggingService.info(
  //           '주기적 탐색으로 생성된 세션에서 HP 처리 시작',
  //           {
  //             service: 'SESSION_MANAGER',
  //             method: 'scanForHighPremiumOpportunities',
  //             sessionId: session.id,
  //             symbol: opportunity.symbol,
  //           },
  //         );

  //         break; // 하나의 기회만 처리
  //       } else {
  //         this.loggingService.debug('자금 부족으로 세션 생성 건너뜀', {
  //           service: 'SESSION_MANAGER',
  //           method: 'scanForHighPremiumOpportunities',
  //           symbol: opportunity.symbol,
  //         });
  //       }
  //     }
  //   }
  // }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async scanForHighPremiumOpportunities() {
    // 기존 로직을 새로운 메서드로 위임
    await this.scanForArbitrageOpportunities();
  }

  // 저프리미엄 기회 탐색 및 처리 (새로 추가)
  @Cron(CronExpression.EVERY_5_SECONDS)
  async scanForLowPremiumOpportunities() {
    // LP 처리 중인 세션이 있으면 탐색 건너뛰기
    const processingLPSessions = this.sessionStateService.getSessionsByStatus(
      SessionStatus.LOW_PREMIUM_PROCESSING,
    );

    if (processingLPSessions.length > 0) {
      this.logger.debug(
        `[SESSION_MANAGER] LP 처리 중인 세션 ${processingLPSessions.length}개가 있어 새 LP 탐색을 건너뜁니다.`,
      );
      return;
    }

    // AWAITING_LOW_PREMIUM 상태의 세션들 확인
    const awaitingLPSessions = this.sessionStateService.getSessionsByStatus(
      SessionStatus.AWAITING_LOW_PREMIUM,
    );

    if (awaitingLPSessions.length === 0) {
      // this.logger.debug(`[SESSION_MANAGER] LP 대기 중인 세션이 없습니다.`);
      return;
    }

    this.logger.log(
      `[SESSION_MANAGER] LP 대기 중인 세션 ${awaitingLPSessions.length}개에 대해 LP 기회 탐색 시작`,
    );

    // 각 세션별로 독립적인 LP 탐색
    for (const session of awaitingLPSessions) {
      await this.sessionExecutorService.processLowPremiumForSession(session);
    }
  }

  // private async checkHighPremiumOpportunity(symbol: string): Promise<any> {
  //   const upbitPrice = this.priceFeedService.getUpbitPrice(symbol);
  //   const binancePrice = this.priceFeedService.getBinancePrice(symbol);

  //   if (upbitPrice === undefined || binancePrice === undefined) {
  //     return null;
  //   }

  //   // 중앙화된 설정 서비스 사용
  //   const investmentKRW =
  //     await this.portfolioManagerService.getCurrentInvestmentAmount();

  //   const rate = this.exchangeService.getUSDTtoKRW();

  //   if (rate === 0) {
  //     return null;
  //   }

  //   const investmentUSDT = investmentKRW / rate;

  //   const opportunity = await this.spreadCalculatorService.calculateSpread({
  //     symbol,
  //     upbitPrice,
  //     binancePrice,
  //     investmentUSDT,
  //   });

  //   return opportunity;
  // }

  // 세션 완료 처리
  async completeSession(sessionId: string, success: boolean): Promise<void> {
    const status = success ? SessionStatus.COMPLETED : SessionStatus.FAILED;
    this.sessionStateService.updateSessionStatus(sessionId, status);

    this.logger.log(`[SESSION_MANAGER] 세션 완료: ${sessionId} (${status})`);
  }

  // 세션 상태 조회
  getSessionStatus(): {
    total: number;
    idle: number;
    processing: number;
    awaiting: number;
    completed: number;
    failed: number;
  } {
    const allSessions = this.sessionStateService.getActiveSessions();
    const completedSessions = this.sessionStateService.getSessionsByStatus(
      SessionStatus.COMPLETED,
    );
    const failedSessions = this.sessionStateService.getSessionsByStatus(
      SessionStatus.FAILED,
    );

    return {
      total:
        allSessions.length + completedSessions.length + failedSessions.length,
      idle: this.sessionStateService.getSessionsByStatus(SessionStatus.IDLE)
        .length,
      processing: this.sessionStateService.getSessionsByStatus(
        SessionStatus.HIGH_PREMIUM_PROCESSING,
      ).length,
      awaiting: this.sessionStateService.getSessionsByStatus(
        SessionStatus.AWAITING_LOW_PREMIUM,
      ).length,
      completed: completedSessions.length,
      failed: failedSessions.length,
    };
  }

  // 시장 상태별 기회 감지 메서드 추가
  async checkNormalOpportunity(symbol: string): Promise<any> {
    const investmentKRW =
      await this.portfolioManagerService.getCurrentInvestmentAmount();
    const rate = this.exchangeService.getUSDTtoKRW();

    if (rate === 0) {
      return null;
    }

    const investmentUSDT = investmentKRW / rate;

    return await this.spreadCalculatorService.checkNormalOpportunity(
      symbol,
      investmentUSDT,
    );
  }

  async checkReverseOpportunity(symbol: string): Promise<any> {
    const investmentKRW =
      await this.portfolioManagerService.getCurrentInvestmentAmount();

    return await this.spreadCalculatorService.checkReverseOpportunity(
      symbol,
      investmentKRW,
    );
  }

  // 기존 checkHighPremiumOpportunity 메서드를 checkNormalOpportunity로 리팩토링
  async checkHighPremiumOpportunity(symbol: string): Promise<any> {
    return this.checkNormalOpportunity(symbol);
  }

  // 새로운 스캔 메서드: 양방향 기회 탐색
  @Cron(CronExpression.EVERY_30_SECONDS)
  async scanForArbitrageOpportunities() {
    // 🔥 추가: 단일 사이클 테스트 모드 체크
    const singleCycleTest =
      this.configService.get('SINGLE_CYCLE_TEST') === 'true';
    const maxCycles = parseInt(
      this.configService.get('PRETEST_MAX_CYCLES') || '1',
    );

    // 이미 완료된 사이클 수 확인
    const completedCycles = this.sessionStateService.getSessionsByStatus(
      SessionStatus.COMPLETED,
    ).length;
    const failedCycles = this.sessionStateService.getSessionsByStatus(
      SessionStatus.FAILED,
    ).length;
    const totalCompletedCycles = completedCycles + failedCycles;

    if (singleCycleTest && totalCompletedCycles >= maxCycles) {
      this.logger.log(
        `[SINGLE_CYCLE_TEST] 목표 사이클 수(${maxCycles}) 달성. 더 이상 실행하지 않습니다.`,
      );
      return;
    }

    const idleSessions = this.sessionStateService.getSessionsByStatus(
      SessionStatus.IDLE,
    );

    // IDLE 세션이 있으면 기존 세션에서 처리
    if (idleSessions.length > 0) {
      this.loggingService.debug('IDLE 세션이 있어 새 세션 생성을 건너뜀', {
        service: 'SESSION_MANAGER',
        method: 'scanForArbitrageOpportunities',
        data: { idleSessionCount: idleSessions.length },
      });
      return;
    }
    // 🔥 추가: 진행 중인 세션이 있으면 새 세션 생성 금지
    const processingSessions = this.sessionStateService
      .getSessionsByStatus(SessionStatus.NORMAL_PROCESSING)
      .concat(
        this.sessionStateService.getSessionsByStatus(
          SessionStatus.REVERSE_PROCESSING,
        ),
      )
      .concat(
        this.sessionStateService.getSessionsByStatus(
          SessionStatus.HIGH_PREMIUM_PROCESSING,
        ),
      )
      .concat(
        this.sessionStateService.getSessionsByStatus(
          SessionStatus.LOW_PREMIUM_PROCESSING,
        ),
      );

    if (processingSessions.length > 0) {
      this.logger.log(
        `[SINGLE_CYCLE_TEST] 진행 중인 세션 ${processingSessions.length}개가 있어 새 세션 생성을 건너뜁니다.`,
      );
      return;
    }

    // IDLE 세션이 없으면 양방향 기회 탐색
    const watchedSymbols = this.priceFeedService.getWatchedSymbols();

    for (const symbolConfig of watchedSymbols) {
      const symbol = symbolConfig.symbol;

      // 시장 상태 확인
      const marketState = this.spreadCalculatorService.getMarketState(symbol);

      if (!marketState) {
        continue;
      }

      let opportunity = null;
      let session = null;

      // 시장 상태에 따른 기회 탐색
      if (marketState.marketState === 'NORMAL') {
        opportunity = await this.checkNormalOpportunity(symbol);
        if (opportunity) {
          session = await this.createNormalSession(opportunity);
        }
      } else if (marketState.marketState === 'REVERSE') {
        opportunity = await this.checkReverseOpportunity(symbol);
        if (opportunity) {
          session = await this.createReverseSession(opportunity);
        }
      }

      if (session) {
        this.loggingService.info(
          `${marketState.marketState} 기회 발견으로 새 세션 생성`,
          {
            service: 'SESSION_MANAGER',
            method: 'scanForArbitrageOpportunities',
            sessionId: session.id,
            symbol: opportunity.symbol,
            marketDirection: session.marketDirection,
            strategyType: session.strategyType,
          },
        );

        // 세션 실행
        if (session.marketDirection === 'NORMAL') {
          await this.sessionExecutorService.executeHighPremiumOpportunity(
            session,
            opportunity,
          );
        } else {
          await this.sessionExecutorService.executeReverseOpportunity(
            session,
            opportunity,
          );
        }

        break; // 하나의 기회만 처리
      }
    }
  }
}
