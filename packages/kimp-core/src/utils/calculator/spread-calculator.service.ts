import { Injectable, Logger } from '@nestjs/common';
import { FeeCalculatorService } from './fee-calculator.service';
import { SlippageCalculatorService } from './slippage-calculator.service';
import { InvestmentConfigService } from '../../config/investment-config.service';
import { ExchangeService } from '../../exchange/exchange.service';
import { SettingsService } from '../service/settings.service';

export interface SpreadCalculationParams {
  symbol: string;
  upbitPrice: number;
  binancePrice: number;
  investmentAmount: number;
  upbitVolume24h?: number;
}

export interface SpreadCalculationResult {
  symbol: string;
  upbitPrice: number;
  binancePrice: number;
  spreadPercent: number;
  isNormalOpportunity: boolean;
  netProfitPercent: number;
  totalFee: number;
  slippageImpact: number;
  volumeCheck: boolean;
}

@Injectable()
export class SpreadCalculatorService {
  private readonly logger = new Logger(SpreadCalculatorService.name);

  constructor(
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly slippageCalculatorService: SlippageCalculatorService,
    private readonly investmentConfigService: InvestmentConfigService,
    private readonly exchangeService: ExchangeService,
    private readonly settingsService: SettingsService,
  ) {}

  async calculateSpread(
    params: SpreadCalculationParams,
  ): Promise<SpreadCalculationResult | null> {
    const {
      symbol,
      upbitPrice,
      binancePrice,
      investmentAmount,
      upbitVolume24h,
    } = params;

    if (upbitPrice === undefined || binancePrice === undefined) {
      this.logger.debug(`[${symbol}] 가격 정보 누락`);
      return null;
    }

    // 1단계: 기본 스프레드 계산
    const spreadPercent =
      Math.abs((upbitPrice - binancePrice) / upbitPrice) * 100;
    const isNormalOpportunity = upbitPrice > binancePrice;

    // 설정에서 최소 스프레드 확인
    const minSpreadSetting = await this.settingsService.getSetting(
      'INITIATOR_MIN_SPREAD',
    );
    const minSpreadPercent = minSpreadSetting
      ? parseFloat(minSpreadSetting)
      : 0.5; // 기본값 0.5%

    if (spreadPercent < minSpreadPercent) {
      this.logger.debug(
        `[${symbol}] 스프레드 부족: ${spreadPercent.toFixed(2)}% < ${minSpreadPercent}%`,
      );
      return null;
    }

    // 2단계: 환율 및 투자 금액 계산
    const config = this.investmentConfigService.getInvestmentConfig();
    const rate = config.exchangeRateUsdtKrw;
    const buyAmount = investmentAmount / binancePrice;

    if (buyAmount <= 0) {
      this.logger.debug(`[${symbol}] 투자 가능 금액 부족`);
      return null;
    }

    // 3단계: 수수료 계산
    const feeResult = this.feeCalculatorService.calculate({
      symbol,
      amount: buyAmount,
      upbitPrice,
      binancePrice,
      rate,
      tradeDirection: isNormalOpportunity
        ? 'HIGH_PREMIUM_SELL_UPBIT'
        : 'LOW_PREMIUM_SELL_BINANCE',
    });

    // 수익성 필터링
    if (feeResult.netProfitPercent <= 0) {
      this.logger.debug(
        `[${symbol}] 수익성 부족: ${feeResult.netProfitPercent.toFixed(2)}%`,
      );
      return null;
    }

    // 4단계: 슬리피지 계산 (현재는 기본값 사용, 실제로는 OrderBook 데이터가 필요)
    const slippageImpact = 0.1; // 기본 슬리피지 0.1%

    // 슬리피지 반영 후 최종 수익률 계산
    const finalProfitPercent = feeResult.netProfitPercent - slippageImpact;

    if (finalProfitPercent <= 0) {
      this.logger.debug(
        `[${symbol}] 슬리피지 반영 후 수익성 부족: ${finalProfitPercent.toFixed(2)}%`,
      );
      return null;
    }

    // 5단계: 거래량 확인
    const volumeCheck = this.checkVolumeRequirement(
      upbitVolume24h,
      investmentAmount,
    );

    if (!volumeCheck) {
      this.logger.debug(`[${symbol}] 거래량 요구사항 미충족`);
      return null;
    }

    this.logger.log(
      `[${symbol}] 기회 감지: 스프레드 ${spreadPercent.toFixed(2)}%, 순수익 ${finalProfitPercent.toFixed(2)}%`,
    );

    return {
      symbol,
      upbitPrice,
      binancePrice,
      spreadPercent,
      isNormalOpportunity,
      netProfitPercent: finalProfitPercent,
      totalFee: feeResult.totalFee,
      slippageImpact,
      volumeCheck,
    };
  }

  private checkVolumeRequirement(
    volume24h?: number,
    investmentAmount?: number,
  ): boolean {
    if (!volume24h || !investmentAmount) {
      return true; // 거래량 정보가 없으면 기본적으로 통과
    }

    // 투자 금액이 24시간 거래량의 1%를 초과하지 않도록 확인
    const maxInvestmentRatio = 0.01;
    const maxInvestmentAmount = volume24h * maxInvestmentRatio;

    return investmentAmount <= maxInvestmentAmount;
  }

  public getMarketState(symbol: string): {
    symbol: string;
    upbitPrice: number | undefined;
    binancePrice: number | undefined;
    rate: number;
    binancePriceKRW: number;
    rawPremiumPercent: number;
    marketState: 'NORMAL' | 'REVERSE' | 'NEUTRAL';
    timestamp: Date;
  } | null {
    try {
      const config = this.investmentConfigService.getInvestmentConfig();
      const rate = config.exchangeRateUsdtKrw;

      // 실제 구현에서는 ExchangeService에서 현재 가격을 가져와야 함
      // 여기서는 기본 구조만 제공
      return {
        symbol,
        upbitPrice: undefined,
        binancePrice: undefined,
        rate,
        binancePriceKRW: 0,
        rawPremiumPercent: 0,
        marketState: 'NEUTRAL',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`[${symbol}] 시장 상태 조회 실패: ${error.message}`);
      return null;
    }
  }
}
