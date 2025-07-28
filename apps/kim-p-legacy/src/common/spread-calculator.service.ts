// src/common/spread-calculator.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ExchangeService } from './exchange.service';
import { FeeCalculatorService } from './fee-calculator.service';
import { HighPremiumConditionData } from '../arbitrage/high-premium-processor.service';
import { SlippageCalculatorService } from './slippage-calculator.service'; // ⭐️ Import 추가
import { ConfigService } from '@nestjs/config'; // ⭐️ ConfigService 추가
import { PriceFeedService } from 'src/marketdata/price-feed.service';

@Injectable()
export class SpreadCalculatorService {
  private readonly logger = new Logger(SpreadCalculatorService.name);
  private readonly MINIMUM_VOLUME_KRW: number;
  private readonly MIN_PROFIT_AFTER_SLIPPAGE: number;

  // ⭐️ SlippageCalculatorService 등 필요한 서비스들을 주입받습니다.
  constructor(
    private readonly exchangeService: ExchangeService,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly slippageCalculatorService: SlippageCalculatorService,
    private readonly configService: ConfigService,
    private readonly priceFeedService: PriceFeedService,
  ) {
    this.MINIMUM_VOLUME_KRW =
      this.configService.get<number>('MINIMUM_VOLUME_KRW') || 5000000000;
    this.MIN_PROFIT_AFTER_SLIPPAGE =
      this.configService.get<number>('MIN_PROFIT_AFTER_SLIPPAGE') || 0.2;
  }

  // ⭐️ 메소드 시그니처를 수정하여 실제 투자금을 받도록 합니다.
  async calculateSpread(params: {
    symbol: string;
    upbitPrice: number;
    binancePrice: number;
    investmentUSDT: number;
    upbitVolume24h?: number;
  }): Promise<HighPremiumConditionData | null> {
    const { symbol, upbitPrice, binancePrice, investmentUSDT, upbitVolume24h } =
      params;

    if (upbitPrice === undefined || binancePrice === undefined) {
      return null;
    }

    // --- 1단계: 기본 수익성 필터 ---
    const rate = this.exchangeService.getUSDTtoKRW();

    const binancePriceKRW = binancePrice * rate;
    const rawPremiumPercent =
      ((upbitPrice - binancePriceKRW) / binancePriceKRW) * 100;

    // this.logger.verbose(
    //   `[프리미엄 분석] ${symbol.toUpperCase()}: 수수료 미반영 프리미엄 ${rawPremiumPercent.toFixed(2)}% (업비트: ${upbitPrice.toFixed(0)} KRW, 바이낸스 환산: ${binancePriceKRW.toFixed(0)} KRW)`,
    // );

    const buyAmount = investmentUSDT / binancePrice;
    if (buyAmount <= 0) return null;

    // ❗️ fee-calculator는 실제 계정 수수료를 받아야 더 정확합니다. 우선 기존 로직을 따릅니다.
    const feeResult = this.feeCalculatorService.calculate({
      symbol,
      amount: buyAmount,
      upbitPrice,
      binancePrice,
      rate,
      tradeDirection: 'HIGH_PREMIUM_SELL_UPBIT',
    });

    // 최소 진입 프리미엄 기준 (예: 1.5%)을 여기에 추가할 수 있습니다.
    const MINIMUM_ENTRY_PREMIUM = 0.8;
    if (feeResult.netProfitPercent < MINIMUM_ENTRY_PREMIUM) {
      const initialInvestmentKRW = investmentUSDT * rate;
      const rawProfitKRW = initialInvestmentKRW * (rawPremiumPercent / 100);

      // 총수수료 세부 항목 계산
      const tradeFee =
        (feeResult.binanceSpotBuyFeeKrw || 0) +
        (feeResult.upbitSellFeeKrw || 0);
      const transferFee = feeResult.transferCoinToUpbitFeeKrw || 0;
      const otherFee =
        (feeResult.usdtTransferFeeKrw || 0) +
        (feeResult.binanceFuturesEntryFeeKrw || 0) +
        (feeResult.binanceFuturesExitFeeKrw || 0);

      // this.logger.verbose(
      //   `[필터링] ${symbol.toUpperCase()}: 최종 순수익률 ${feeResult.netProfitPercent.toFixed(2)}%가 진입 기준 ${MINIMUM_ENTRY_PREMIUM}% 미만입니다.`,
      // );
      // this.logger.verbose(
      //   `  ├ 투자원금: ${initialInvestmentKRW.toFixed(0)} KRW`,
      // );
      // this.logger.verbose(
      //   `  ├ 프리미엄 이익 (수수료 미반영): ${rawProfitKRW.toFixed(0)} KRW (${rawPremiumPercent.toFixed(2)}%)`,
      // );
      // this.logger.verbose(
      //   `  └ 총수수료: -${feeResult.totalFee.toFixed(0)} KRW (거래: ${tradeFee.toFixed(0)}, 전송: ${transferFee.toFixed(0)}, 기타: ${otherFee.toFixed(0)})`,
      // );
      return null;
    }

    this.logger.verbose(
      `[1단계 통과] ${symbol.toUpperCase()}: 기본 수익성 ${feeResult.netProfitPercent.toFixed(2)}% 확인.`,
    );

    // --- 2단계: 거래대금(유동성) 필터 ---
    if (
      upbitVolume24h !== undefined &&
      upbitVolume24h < this.MINIMUM_VOLUME_KRW
    ) {
      return null;
    }

    try {
      // 캐시된 값이 아직 없을 경우(프로그램 시작 직후) 필터링을 건너뜀
      if (upbitVolume24h === undefined) {
        // this.logger.warn(
        //   `[거래대금 필터] ${symbol.toUpperCase()}의 캐시된 거래대금 정보가 아직 없습니다. 필터를 건너뜁니다.`,
        // );
      } else if (upbitVolume24h < this.MINIMUM_VOLUME_KRW) {
        // this.logger.verbose(
        //   `[필터링] ${symbol.toUpperCase()}: 거래대금 ${(upbitVolume24h / 100000000).toFixed(2)}억이 기준치 미달입니다.`,
        // );
        return null;
      }
    } catch (error) {
      // this.logger.warn(
      //   `[필터링] ${symbol.toUpperCase()} 거래대금 확인 중 에러 발생: ${error.message}`,
      // );
      return null;
    }

    // --- 3단계: 호가창(슬리피지) 정밀 필터 ---
    try {
      const orderBook = await this.exchangeService.getOrderBook(
        'binance',
        symbol,
      );
      const slippageResult = this.slippageCalculatorService.calculate(
        orderBook,
        'buy',
        investmentUSDT,
      );

      // 슬리피지를 차감한 최종 예상 수익률 계산
      const finalProfitPercent =
        feeResult.netProfitPercent - slippageResult.slippagePercent;

      if (finalProfitPercent < this.MIN_PROFIT_AFTER_SLIPPAGE) {
        // this.logger.verbose(
        //   `[필터링] ${symbol.toUpperCase()}: 슬리피지(${slippageResult.slippagePercent.toFixed(2)}%) 반영 최종 수익 ${finalProfitPercent.toFixed(2)}%가 기준치 미달입니다.`,
        // );
        return null; // 슬리피지 고려 시 수익률 미달이면 기회 아님
      }

      this.logger.log(
        `✅ [거래 기회 발견] ${symbol.toUpperCase()}: 최종 예상 순수익 ${finalProfitPercent.toFixed(2)}% (슬리피지 반영)`,
      );

      // --- 최종 통과: 검증된 기회 반환 ---
      return {
        symbol,
        upbitPrice,
        binancePrice,
        rate,
        netProfit: feeResult.netProfit, // 슬리피지 미반영 순수익
        netProfitPercent: finalProfitPercent, // 슬리피지 반영 최종 수익률
      };
    } catch (error) {
      this.logger.warn(
        `[필터링] ${symbol.toUpperCase()} 슬리피지 확인 실패: ${error.message}`,
      );
      return null;
    }
  }

  // 시장 상태 확인을 위한 새로운 메서드 추가
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
    const upbitPrice = this.priceFeedService.getUpbitPrice(symbol);
    const binancePrice = this.priceFeedService.getBinancePrice(symbol);
    const rate = this.exchangeService.getUSDTtoKRW();

    if (upbitPrice === undefined || binancePrice === undefined || rate === 0) {
      return null;
    }

    const binancePriceKRW = binancePrice * rate;
    const rawPremiumPercent =
      ((upbitPrice - binancePriceKRW) / binancePriceKRW) * 100;

    let marketState: 'NORMAL' | 'REVERSE' | 'NEUTRAL';
    if (rawPremiumPercent > 0.1) {
      marketState = 'NORMAL'; // 업비트 > 바이낸스 (고프리미엄)
    } else if (rawPremiumPercent < -0.1) {
      marketState = 'REVERSE'; // 업비트 < 바이낸스 (저프리미엄)
    } else {
      marketState = 'NEUTRAL'; // 거의 동일
    }

    return {
      symbol,
      upbitPrice,
      binancePrice,
      rate,
      binancePriceKRW,
      rawPremiumPercent,
      marketState,
      timestamp: new Date(),
    };
  }

  public getAllMarketStates(): Array<{
    symbol: string;
    upbitPrice: number | undefined;
    binancePrice: number | undefined;
    rate: number;
    binancePriceKRW: number;
    rawPremiumPercent: number;
    marketState: 'NORMAL' | 'REVERSE' | 'NEUTRAL';
    timestamp: Date;
  }> {
    const watchedSymbols = this.priceFeedService.getWatchedSymbols();
    const states = [];

    for (const symbolConfig of watchedSymbols) {
      const state = this.getMarketState(symbolConfig.symbol);
      if (state) {
        states.push(state);
      }
    }

    return states;
  }

  // Normal 기회 감지 (고프리미엄 기회)
  async checkNormalOpportunity(
    symbol: string,
    investmentUSDT: number,
  ): Promise<any> {
    const upbitPrice = this.priceFeedService.getUpbitPrice(symbol);
    const binancePrice = this.priceFeedService.getBinancePrice(symbol);
    const upbitVolume24h = this.priceFeedService.getUpbitVolume(symbol);

    if (upbitPrice === undefined || binancePrice === undefined) {
      return null;
    }

    // 기존 calculateSpread 메서드 사용 (고프리미엄 로직)
    const opportunity = await this.calculateSpread({
      symbol,
      upbitPrice,
      binancePrice,
      investmentUSDT,
      upbitVolume24h,
    });

    if (opportunity) {
      return {
        ...opportunity,
        marketDirection: 'NORMAL',
        strategyType: 'HIGH_PREMIUM_FIRST',
      };
    }

    return null;
  }

  // Reverse 기회 감지 (저프리미엄 기회)
  async checkReverseOpportunity(
    symbol: string,
    investmentKRW: number,
  ): Promise<any> {
    const upbitPrice = this.priceFeedService.getUpbitPrice(symbol);
    const binancePrice = this.priceFeedService.getBinancePrice(symbol);
    const upbitVolume24h = this.priceFeedService.getUpbitVolume(symbol);

    if (upbitPrice === undefined || binancePrice === undefined) {
      return null;
    }

    const rate = this.exchangeService.getUSDTtoKRW();
    if (rate === 0) {
      return null;
    }

    // 저프리미엄 계산 (업비트 구매 → 바이낸스 판매)
    const binancePriceKRW = binancePrice * rate;
    const rawPremiumPercent =
      ((upbitPrice - binancePriceKRW) / binancePriceKRW) * 100;

    // 저프리미엄 기회는 음수 프리미엄이어야 함
    if (rawPremiumPercent > -0.1) {
      return null; // 저프리미엄 기회가 아님
    }

    const buyAmount = investmentKRW / upbitPrice;
    if (buyAmount <= 0) return null;

    // 저프리미엄 수수료 계산
    const feeResult = this.feeCalculatorService.calculate({
      symbol,
      amount: buyAmount,
      upbitPrice,
      binancePrice,
      rate,
      tradeDirection: 'LOW_PREMIUM_SELL_BINANCE',
    });

    // 저프리미엄에서는 손실을 허용하되, 최대 허용 손실 범위 내여야 함
    const MAX_ALLOWED_LOSS_PERCENT = -1.5; // 최대 1.5% 손실 허용
    if (feeResult.netProfitPercent < MAX_ALLOWED_LOSS_PERCENT) {
      return null;
    }

    // 거래대금 필터
    if (
      upbitVolume24h !== undefined &&
      upbitVolume24h < this.MINIMUM_VOLUME_KRW
    ) {
      return null;
    }

    // 슬리피지 계산
    try {
      const orderBook = this.priceFeedService.getUpbitOrderBook(symbol);
      if (!orderBook) {
        return null;
      }

      const slippageResult = this.slippageCalculatorService.calculate(
        orderBook,
        'buy',
        investmentKRW,
      );

      // 슬리피지를 차감한 최종 예상 손실률 계산
      const finalLossPercent =
        feeResult.netProfitPercent - slippageResult.slippagePercent;

      if (finalLossPercent < MAX_ALLOWED_LOSS_PERCENT) {
        return null;
      }

      this.logger.log(
        `✅ [Reverse 기회 발견] ${symbol.toUpperCase()}: 최종 예상 손실 ${finalLossPercent.toFixed(2)}% (슬리피지 반영)`,
      );

      return {
        symbol,
        upbitPrice,
        binancePrice,
        rate,
        investmentKRW,
        expectedLoss: Math.abs(feeResult.netProfit), // 손실을 양수로 변환
        expectedLossPercent: finalLossPercent,
        marketDirection: 'REVERSE',
        strategyType: 'LOW_PREMIUM_FIRST',
      };
    } catch (error) {
      this.logger.warn(
        `[Reverse 필터링] ${symbol.toUpperCase()} 슬리피지 확인 실패: ${error.message}`,
      );
      return null;
    }
  }
}
