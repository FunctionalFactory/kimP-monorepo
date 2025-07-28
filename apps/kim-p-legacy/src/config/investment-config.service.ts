import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface InvestmentConfig {
  strategy: 'FIXED_AMOUNT' | 'PERCENTAGE' | 'FULL_CAPITAL';
  fixedAmountKrw: number;
  percentage: number;
  initialCapitalKrw: number;
}

@Injectable()
export class InvestmentConfigService {
  private readonly logger = new Logger(InvestmentConfigService.name);
  private cachedConfig: InvestmentConfig | null = null;
  private lastConfigUpdate = 0;
  private readonly CONFIG_CACHE_DURATION = 60000; // 1분 캐시

  constructor(private readonly configService: ConfigService) {}

  /**
   * 투자 설정을 가져옵니다 (캐시 적용)
   */
  getInvestmentConfig(): InvestmentConfig {
    const now = Date.now();

    // 캐시가 유효하면 캐시된 설정 반환
    if (
      this.cachedConfig &&
      now - this.lastConfigUpdate < this.CONFIG_CACHE_DURATION
    ) {
      return this.cachedConfig;
    }

    // 새로운 설정 로드
    const strategy =
      this.configService.get<string>('INVESTMENT_STRATEGY') || 'FIXED_AMOUNT';
    const fixedAmountKrw =
      this.configService.get<number>('SESSION_INVESTMENT_AMOUNT_KRW') || 250000;
    const percentage =
      this.configService.get<number>('INVESTMENT_PERCENTAGE') || 10;
    const initialCapitalKrw =
      this.configService.get<number>('INITIAL_CAPITAL_KRW') || 1000000;

    this.cachedConfig = {
      strategy: strategy as 'FIXED_AMOUNT' | 'PERCENTAGE' | 'FULL_CAPITAL',
      fixedAmountKrw,
      percentage,
      initialCapitalKrw,
    };

    this.lastConfigUpdate = now;

    this.logger.debug(
      `[INVESTMENT_CONFIG] 설정 로드: ${strategy}, 고정금액: ${fixedAmountKrw.toLocaleString()} KRW, 비율: ${percentage}%`,
    );

    return this.cachedConfig;
  }

  /**
   * 현재 설정에 따른 투자금을 계산합니다
   */
  calculateInvestmentAmount(currentTotalCapitalKrw: number): number {
    const config = this.getInvestmentConfig();

    switch (config.strategy) {
      case 'FIXED_AMOUNT':
        return config.fixedAmountKrw;

      case 'PERCENTAGE':
        if (config.percentage > 0 && config.percentage <= 100) {
          return currentTotalCapitalKrw * (config.percentage / 100);
        }
        // 유효하지 않은 비율이면 전체 자본 사용
        return currentTotalCapitalKrw;

      case 'FULL_CAPITAL':
      default:
        return currentTotalCapitalKrw;
    }
  }

  /**
   * 설정 캐시를 무효화합니다 (설정 변경 시 호출)
   */
  invalidateCache(): void {
    this.cachedConfig = null;
    this.lastConfigUpdate = 0;
    this.logger.debug('[INVESTMENT_CONFIG] 설정 캐시 무효화');
  }

  /**
   * 설정 유효성을 검증합니다
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const config = this.getInvestmentConfig();
    const errors: string[] = [];

    if (config.fixedAmountKrw <= 0) {
      errors.push('SESSION_INVESTMENT_AMOUNT_KRW는 0보다 커야 합니다');
    }

    if (config.percentage < 0 || config.percentage > 100) {
      errors.push('INVESTMENT_PERCENTAGE는 0-100 사이여야 합니다');
    }

    if (config.initialCapitalKrw <= 0) {
      errors.push('INITIAL_CAPITAL_KRW는 0보다 커야 합니다');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
