import { Injectable, Logger } from '@nestjs/common';
import { SessionManagerService } from '../session/session-manager.service';
import { SessionStateService } from '../session/session-state.service';
import { PortfolioLogService } from '../db/portfolio-log.service';
import { PriceFeedService } from '../marketdata/price-feed.service';
import { ExchangeService } from '../common/exchange.service';
import { FeeCalculatorService } from '../common/fee-calculator.service';
import { SessionStatus } from '../session/interfaces/session.interface';
import { TelegramService } from '../common/telegram.service';

export interface SystemStatus {
  totalSessions: number;
  idleSessions: number;
  processingSessions: number;
  awaitingSessions: number;
  completedSessions: number;
  failedSessions: number;
  systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export interface PortfolioStatus {
  totalBalanceKRW: number;
  upbitBalanceKRW: number;
  binanceBalanceKRW: number;
  totalProfitKRW: number;
  totalProfitPercent: number;
  lastUpdate: Date;
}

export interface PremiumInfo {
  symbol: string;
  upbitPrice: number;
  binancePrice: number;
  premiumPercent: number;
  volumeKRW: number;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    private readonly sessionManagerService: SessionManagerService,
    private readonly sessionStateService: SessionStateService,
    private readonly portfolioLogService: PortfolioLogService,
    private readonly priceFeedService: PriceFeedService,
    private readonly exchangeService: ExchangeService,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly telegramService: TelegramService,
  ) {
    this.initializeTelegramHandlers();
  }

  private initializeTelegramHandlers() {
    // 상태 조회 핸들러
    this.telegramService.injectCommandHandler('status', async () => {
      const status = await this.getSystemStatus();
      return this.formatSystemStatus(status);
    });

    // 세션 정보 핸들러
    this.telegramService.injectCommandHandler('sessions', async () => {
      const sessions = await this.getDetailedSessionInfo();
      return this.formatSessionInfo(sessions);
    });

    // 포트폴리오 정보 핸들러
    this.telegramService.injectCommandHandler('portfolio', async () => {
      const portfolio = await this.getPortfolioStatus();
      return this.formatPortfolioStatus(portfolio);
    });

    // 프리미엄 정보 핸들러
    this.telegramService.injectCommandHandler('premiums', async () => {
      const premiums = await this.getPremiumInfo();
      return this.formatPremiumInfo(premiums);
    });
  }

  async getSystemStatus(): Promise<SystemStatus> {
    const status = this.sessionManagerService.getSessionStatus();

    let systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';

    if (status.failed > 0) {
      systemHealth = 'CRITICAL';
    } else if (status.processing > 5) {
      systemHealth = 'WARNING';
    }

    return {
      totalSessions: status.total,
      idleSessions: status.idle,
      processingSessions: status.processing,
      awaitingSessions: status.awaiting,
      completedSessions: status.completed,
      failedSessions: status.failed,
      systemHealth,
    };
  }

  async getDetailedSessionInfo() {
    const activeSessions = this.sessionStateService.getActiveSessions();
    const completedSessions = this.sessionStateService.getSessionsByStatus(
      SessionStatus.COMPLETED,
    );
    const failedSessions = this.sessionStateService.getSessionsByStatus(
      SessionStatus.FAILED,
    );

    const allSessions = [
      ...activeSessions,
      ...completedSessions,
      ...failedSessions,
    ];
    const sessionDetails = [];

    for (const session of allSessions) {
      const detail = {
        id: session.id,
        status: session.status,
        createdAt: session.createdAt,
        highPremiumData: session.highPremiumData,
        lowPremiumData: session.lowPremiumData,
        priority: session.priority,
      };
      sessionDetails.push(detail);
    }

    return sessionDetails;
  }

  async getPortfolioStatus(): Promise<PortfolioStatus> {
    const latestPortfolio = await this.portfolioLogService.getLatestPortfolio();

    if (!latestPortfolio) {
      throw new Error('포트폴리오 정보를 찾을 수 없습니다.');
    }

    return {
      totalBalanceKRW: latestPortfolio.total_balance_krw || 0,
      upbitBalanceKRW: latestPortfolio.upbit_balance_krw || 0,
      binanceBalanceKRW: latestPortfolio.binance_balance_krw || 0,
      totalProfitKRW: latestPortfolio.cycle_pnl_krw || 0,
      totalProfitPercent: latestPortfolio.cycle_pnl_rate_percent || 0,
      lastUpdate: latestPortfolio.timestamp,
    };
  }

  async getPremiumInfo(): Promise<{
    highest: PremiumInfo;
    lowest: PremiumInfo;
  }> {
    const watchedSymbols = this.priceFeedService.getWatchedSymbols();
    const rate = this.exchangeService.getUSDTtoKRW();

    const premiumData: PremiumInfo[] = [];

    for (const symbolConfig of watchedSymbols) {
      const upbitPrice = this.priceFeedService.getUpbitPrice(
        symbolConfig.symbol,
      );
      const binancePrice = this.priceFeedService.getBinancePrice(
        symbolConfig.symbol,
      );
      const volume = this.priceFeedService.getUpbitVolume(symbolConfig.symbol);

      if (upbitPrice && binancePrice && volume) {
        const premiumPercent =
          ((upbitPrice - binancePrice * rate) / (binancePrice * rate)) * 100;

        premiumData.push({
          symbol: symbolConfig.symbol.toUpperCase(),
          upbitPrice,
          binancePrice,
          premiumPercent,
          volumeKRW: volume,
        });
      }
    }

    // 프리미엄 기준으로 정렬
    premiumData.sort((a, b) => b.premiumPercent - a.premiumPercent);

    return {
      highest: premiumData[0],
      lowest: premiumData[premiumData.length - 1],
    };
  }

  private formatSystemStatus(status: SystemStatus): string {
    const healthEmoji = {
      HEALTHY: '��',
      WARNING: '��',
      CRITICAL: '🔴',
    };

    return (
      `🤖 *시스템 상태*\n\n` +
      `${healthEmoji[status.systemHealth]} *상태*: ${status.systemHealth}\n\n` +
      `📊 *세션 현황*\n` +
      `• 전체: ${status.totalSessions}개\n` +
      `• 대기: ${status.idleSessions}개\n` +
      `• 처리중: ${status.processingSessions}개\n` +
      `• LP 대기: ${status.awaitingSessions}개\n` +
      `• 완료: ${status.completedSessions}개\n` +
      `• 실패: ${status.failedSessions}개\n\n` +
      `⏰ ${new Date().toLocaleString('ko-KR')}`
    );
  }

  private formatSessionInfo(sessions: any[]): string {
    if (sessions.length === 0) {
      return '�� *세션 정보*\n\n현재 활성 세션이 없습니다.';
    }

    let message = '📋 *활성 세션 정보*\n\n';

    for (const session of sessions.slice(0, 5)) {
      // 최대 5개만 표시
      const statusEmoji = {
        [SessionStatus.IDLE]: '⏳',
        [SessionStatus.NORMAL_PROCESSING]: '⏰',
        [SessionStatus.REVERSE_PROCESSING]: '⏰',
        [SessionStatus.AWAITING_SECOND_STEP]: '⏰',
        [SessionStatus.COMPLETED]: '✅',
        [SessionStatus.FAILED]: '❌',
      };

      const symbol = session.highPremiumData?.symbol || 'N/A';
      const profit = session.highPremiumData?.expectedProfit || 0;

      message +=
        `${statusEmoji[session.status]} *${session.id.slice(0, 8)}*\n` +
        `• 상태: ${session.status}\n` +
        `• 코인: ${symbol}\n` +
        `• 예상수익: ${profit.toLocaleString()}원\n` +
        `• 생성: ${session.createdAt.toLocaleString('ko-KR')}\n\n`;
    }

    if (sessions.length > 5) {
      message += `... 외 ${sessions.length - 5}개 세션`;
    }

    return message;
  }

  private formatPortfolioStatus(portfolio: PortfolioStatus): string {
    const profitEmoji = portfolio.totalProfitKRW >= 0 ? '��' : '��';
    const profitColor = portfolio.totalProfitKRW >= 0 ? '🟢' : '🔴';

    return (
      `�� *포트폴리오 현황*\n\n` +
      `💵 *총 자산*: ${portfolio.totalBalanceKRW.toLocaleString()}원\n\n` +
      `🏦 *거래소별 잔고*\n` +
      `• 업비트: ${portfolio.upbitBalanceKRW.toLocaleString()}원\n` +
      `• 바이낸스: ${portfolio.binanceBalanceKRW.toLocaleString()}원\n\n` +
      `${profitEmoji} *손익 현황*\n` +
      `${profitColor} 수익: ${portfolio.totalProfitKRW.toLocaleString()}원\n` +
      `${profitColor} 수익률: ${portfolio.totalProfitPercent.toFixed(2)}%\n\n` +
      `🕐 최종 업데이트: ${portfolio.lastUpdate.toLocaleString('ko-KR')}`
    );
  }

  private formatPremiumInfo(premiums: {
    highest: PremiumInfo;
    lowest: PremiumInfo;
  }): string {
    const { highest, lowest } = premiums;

    const formatPremium = (info: PremiumInfo) => {
      const emoji = info.premiumPercent >= 0 ? '📈' : '��';
      return (
        `${emoji} *${info.symbol}*\n` +
        `• 프리미엄: ${info.premiumPercent.toFixed(2)}%\n` +
        `• 업비트: ${info.upbitPrice.toLocaleString()}원\n` +
        `• 바이낸스: ${info.binancePrice.toFixed(4)} USDT\n` +
        `• 거래대금: ${(info.volumeKRW / 100000000).toFixed(1)}억원`
      );
    };

    return (
      `📊 *프리미엄 현황*\n\n` +
      `🥇 *최고 프리미엄*\n${formatPremium(highest)}\n\n` +
      `🥉 *최저 프리미엄*\n${formatPremium(lowest)}\n\n` +
      `⏰ ${new Date().toLocaleString('ko-KR')}`
    );
  }

  // 자동 알림 메서드들
  async sendSystemAlert(message: string): Promise<void> {
    await this.telegramService.sendMessage(`🚨 *시스템 알림*\n\n${message}`);
  }

  async sendTradeCompletionAlert(
    symbol: string,
    profit: number,
    profitPercent: number,
    cycleId: string,
  ): Promise<void> {
    const profitEmoji = profit >= 0 ? '��' : '��';
    const profitColor = profit >= 0 ? '🟢' : '🔴';

    const message =
      `✅ *거래 완료*\n\n` +
      `🪙 코인: ${symbol.toUpperCase()}\n` +
      `🆔 사이클: ${cycleId.slice(0, 8)}\n` +
      `${profitEmoji} 수익: ${profitColor}${profit.toLocaleString()}원\n` +
      `${profitEmoji} 수익률: ${profitColor}${profitPercent.toFixed(2)}%\n\n` +
      `⏰ ${new Date().toLocaleString('ko-KR')}`;

    await this.telegramService.sendMessage(message);
  }

  async sendErrorAlert(error: string, context?: string): Promise<void> {
    const message =
      `❌ *오류 발생*\n\n` +
      `�� 컨텍스트: ${context || 'N/A'}\n` +
      `💬 오류: ${error}\n\n` +
      `⏰ ${new Date().toLocaleString('ko-KR')}`;

    await this.telegramService.sendMessage(message);
  }
}
