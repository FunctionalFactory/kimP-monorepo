import { Injectable, Logger } from '@nestjs/common';
import { PortfolioLogService } from '../../db/portfolio-log.service';
import { InvestmentConfigService } from '../../config/investment-config.service';
import { PortfolioLog } from '../../db/entities/portfolio-log.entity';

@Injectable()
export class PortfolioManagerService {
  private readonly logger = new Logger(PortfolioManagerService.name);

  // 포트폴리오 캐시 추가
  private portfolioCache: {
    latestLog: PortfolioLog | null;
    investmentAmount: number;
    timestamp: number;
  } | null = null;
  private readonly CACHE_DURATION = 5000; // 5초 캐시

  constructor(
    private readonly portfolioLogService: PortfolioLogService,
    private readonly investmentConfigService: InvestmentConfigService,
  ) {}

  /**
   * 현재 총 자본금을 안전하게 조회합니다
   * @returns 현재 총 자본금 (KRW)
   */
  async getCurrentTotalCapital(): Promise<number> {
    try {
      const latestPortfolio =
        await this.portfolioLogService.getLatestPortfolio();

      if (latestPortfolio && latestPortfolio.total_balance_krw !== null) {
        return latestPortfolio.total_balance_krw;
      }

      // 포트폴리오 로그가 없으면 초기 자본금 사용
      const config = this.investmentConfigService.getInvestmentConfig();
      this.logger.warn(
        `[PORTFOLIO_MANAGER] 포트폴리오 로그가 없어 초기 자본금을 사용합니다: ${config.initialCapitalKrw.toLocaleString()} KRW`,
      );

      return config.initialCapitalKrw;
    } catch (error) {
      this.logger.error(
        `[PORTFOLIO_MANAGER] 총 자본금 조회 중 오류: ${error.message}`,
      );

      // 오류 발생 시 초기 자본금 사용
      const config = this.investmentConfigService.getInvestmentConfig();
      return config.initialCapitalKrw;
    }
  }

  /**
   * 현재 투자 가능한 금액을 계산합니다
   * @returns 투자 가능한 금액 (KRW)
   */
  async getCurrentInvestmentAmount(): Promise<number> {
    const currentTotalCapital = await this.getCurrentTotalCapital();
    return this.investmentConfigService.calculateInvestmentAmount(
      currentTotalCapital,
    );
  }

  /**
   * 포트폴리오 정보를 안전하게 조회합니다
   * @returns 포트폴리오 정보 또는 null
   */
  async getLatestPortfolioSafely(): Promise<PortfolioLog | null> {
    try {
      const now = Date.now();

      // 캐시 확인
      if (
        this.portfolioCache &&
        now - this.portfolioCache.timestamp < this.CACHE_DURATION
      ) {
        this.logger.verbose(
          '[PORTFOLIO_MANAGER] 포트폴리오 정보를 캐시에서 반환',
        );
        return this.portfolioCache.latestLog;
      }
      const latestLog = await this.portfolioLogService.getLatestPortfolio();

      this.portfolioCache = {
        latestLog,
        investmentAmount: latestLog
          ? this.investmentConfigService.calculateInvestmentAmount(
              this.parseToNumber(latestLog.total_balance_krw) || 0,
            )
          : 0,
        timestamp: now,
      };
      this.logger.verbose(
        '[PORTFOLIO_MANAGER] 포트폴리오 정보를 새로 조회하여 캐시에 저장',
      );
      return latestLog;
    } catch (error) {
      this.logger.error(
        `[PORTFOLIO_MANAGER] 포트폴리오 조회 중 오류: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * 캐시된 포트폴리오 정보와 투자 금액을 함께 반환합니다
   * @returns 포트폴리오 정보와 투자 금액
   */
  async getLatestPortfolioAndInvestment(): Promise<{
    latestLog: PortfolioLog | null;
    investmentAmount: number;
  }> {
    const now = Date.now();

    // 캐시 확인
    if (
      this.portfolioCache &&
      now - this.portfolioCache.timestamp < this.CACHE_DURATION
    ) {
      this.logger.verbose(
        '[PORTFOLIO_MANAGER] 포트폴리오 정보를 캐시에서 반환',
      );
      return {
        latestLog: this.portfolioCache.latestLog,
        investmentAmount: this.portfolioCache.investmentAmount,
      };
    }

    // 캐시가 없거나 만료된 경우 새로 계산
    const latestLog = await this.getLatestPortfolioSafely();
    const investmentAmount = latestLog
      ? this.investmentConfigService.calculateInvestmentAmount(
          this.parseToNumber(latestLog.total_balance_krw) || 0,
        )
      : 0;

    // 캐시 업데이트
    this.portfolioCache = {
      latestLog,
      investmentAmount,
      timestamp: now,
    };

    this.logger.verbose(
      '[PORTFOLIO_MANAGER] 포트폴리오 정보를 새로 계산하여 캐시에 저장',
    );
    return { latestLog, investmentAmount };
  }

  /**
   * 캐시 무효화 (새 로그 생성 시 호출)
   */
  invalidateCache(): void {
    this.portfolioCache = null;
    this.logger.verbose('[PORTFOLIO_MANAGER] 포트폴리오 캐시 무효화됨');
  }

  /**
   * 숫자 파싱 헬퍼 메서드
   */
  private parseToNumber(value: any): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * 포트폴리오가 유효한지 확인합니다
   * @param portfolio 포트폴리오 정보
   * @returns 유효성 여부
   */
  isValidPortfolio(portfolio: PortfolioLog | null): boolean {
    return (
      portfolio !== null &&
      portfolio.total_balance_krw !== null &&
      portfolio.total_balance_krw > 0
    );
  }
}
