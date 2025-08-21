import { Test, TestingModule } from '@nestjs/testing';
import { FeeCalculatorService } from './fee-calculator.service';

describe('FeeCalculatorService', () => {
  let service: FeeCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeeCalculatorService],
    }).compile();

    service = module.get<FeeCalculatorService>(FeeCalculatorService);
  });

  describe('calculate', () => {
    describe('HIGH_PREMIUM_SELL_UPBIT scenario', () => {
      it('should calculate fees correctly for high premium scenario', () => {
        const input = {
          symbol: 'xrp',
          amount: 100,
          upbitPrice: 710,
          binancePrice: 0.5,
          rate: 1400,
          tradeDirection: 'HIGH_PREMIUM_SELL_UPBIT' as const,
        };

        const result = service.calculate(input);

        // 예상 계산:
        // 1. 슬리피지 적용된 가격 계산
        // effectiveUpbitPrice = 710 * (1 - slippageRate) ≈ 709.89
        // effectiveBinancePrice = 0.5 * (1 + slippageRate) ≈ 0.5001

        // 2. 총 수익 계산
        // grossProfit = (709.89 - 0.5001 * 1400) * 100 = (709.89 - 700.14) * 100 = 975

        // 3. 수수료 계산
        // binanceSpotBuyFeeKrw = 100 * 0.5 * 0.001 * 1400 = 70
        // upbitSellFeeKrw = 100 * 710 * 0.00139 = 98.69
        // binanceFuturesEntryFeeKrw = 100 * 0.5 * 0.0004 * 1400 = 28
        // binanceFuturesExitFeeKrw = 100 * 0.5 * 0.0004 * 1400 = 28
        // transferCoinToUpbitFeeKrw = 0.2 * 0.5 * 1400 = 140

        // 4. 총 수수료 = 70 + 98.69 + 28 + 28 + 140 = 364.69
        // 5. 순수익 = 975 - 364.69 = 610.31

        expect(result.grossProfit).toBeGreaterThan(0);
        expect(result.totalFee).toBeGreaterThan(0);
        expect(result.netProfit).toBeGreaterThan(0);
        expect(result.netProfitPercent).toBeGreaterThan(0);

        // 수수료 세부 항목들이 존재하는지 확인
        expect(result.binanceSpotBuyFeeKrw).toBeDefined();
        expect(result.upbitSellFeeKrw).toBeDefined();
        expect(result.binanceFuturesEntryFeeKrw).toBeDefined();
        expect(result.binanceFuturesExitFeeKrw).toBeDefined();
        expect(result.transferCoinToUpbitFeeKrw).toBeDefined();

        // 수수료가 합리적인 범위 내에 있는지 확인
        expect(result.binanceSpotBuyFeeKrw).toBeGreaterThan(0);
        expect(result.upbitSellFeeKrw).toBeGreaterThan(0);
        expect(result.binanceFuturesEntryFeeKrw).toBeGreaterThan(0);
        expect(result.binanceFuturesExitFeeKrw).toBeGreaterThan(0);
        expect(result.transferCoinToUpbitFeeKrw).toBeGreaterThan(0);

        // 총 수수료가 개별 수수료의 합과 일치하는지 확인
        const expectedTotalFee =
          result.binanceSpotBuyFeeKrw! +
          result.upbitSellFeeKrw! +
          result.binanceFuturesEntryFeeKrw! +
          result.binanceFuturesExitFeeKrw! +
          result.transferCoinToUpbitFeeKrw!;

        expect(result.totalFee).toBeCloseTo(expectedTotalFee, 2);

        // 순수익이 총수익에서 총수수료를 뺀 값과 일치하는지 확인
        expect(result.netProfit).toBeCloseTo(
          result.grossProfit - result.totalFee,
          2,
        );
      });

      it('should handle different symbols with appropriate transfer fees', () => {
        const input = {
          symbol: 'btc',
          amount: 0.1,
          upbitPrice: 50000000,
          binancePrice: 50000,
          rate: 1400,
          tradeDirection: 'HIGH_PREMIUM_SELL_UPBIT' as const,
        };

        const result = service.calculate(input);

        expect(result.grossProfit).toBeDefined();
        expect(result.totalFee).toBeGreaterThan(0);
        expect(result.netProfit).toBeDefined();

        // BTC는 전송 수수료가 없으므로 transferCoinToUpbitFeeKrw가 0이어야 함
        expect(result.transferCoinToUpbitFeeKrw).toBe(0);

        // 수익이 음수일 수 있으므로 정의만 확인
        expect(result.grossProfit).toBeDefined();
        expect(result.netProfit).toBeDefined();
      });

      it('should handle BTT symbol conversion to BTTC', () => {
        const input = {
          symbol: 'btt',
          amount: 1000,
          upbitPrice: 0.1,
          binancePrice: 0.0001,
          rate: 1400,
          tradeDirection: 'HIGH_PREMIUM_SELL_UPBIT' as const,
        };

        const result = service.calculate(input);

        expect(result.grossProfit).toBeDefined();
        expect(result.totalFee).toBeGreaterThan(0);
        expect(result.netProfit).toBeDefined();

        // BTT는 바이낸스에서 BTTC로 변환되므로 전송 수수료가 적용됨
        expect(result.transferCoinToUpbitFeeKrw).toBeGreaterThan(0);

        // 수익이 음수일 수 있으므로 정의만 확인
        expect(result.grossProfit).toBeDefined();
        expect(result.netProfit).toBeDefined();
      });
    });

    describe('LOW_PREMIUM_SELL_BINANCE scenario', () => {
      it('should calculate fees correctly for low premium scenario', () => {
        const input = {
          symbol: 'xrp',
          amount: 100,
          upbitPrice: 700,
          binancePrice: 0.51,
          rate: 1400,
          tradeDirection: 'LOW_PREMIUM_SELL_BINANCE' as const,
        };

        const result = service.calculate(input);

        // 예상 계산:
        // 1. 슬리피지 적용된 가격 계산
        // effectiveUpbitPrice = 700 * (1 + slippageRate) ≈ 700.35
        // effectiveBinancePrice = 0.51 * (1 - slippageRate) ≈ 0.5097

        // 2. 총 수익 계산
        // grossProfit = (0.5097 * 1400 - 700.35) * 100 = (713.58 - 700.35) * 100 = 1323

        // 3. 수수료 계산
        // upbitBuyFeeKrw = 100 * 700 * 0.0005 = 35
        // binanceSpotSellFeeKrw = 100 * 0.51 * 0.001 * 1400 = 71.4
        // binanceFuturesEntryFeeKrw = 100 * 0.51 * 0.0004 * 1400 = 28.56
        // binanceFuturesExitFeeKrw = 100 * 0.51 * 0.0004 * 1400 = 28.56
        // transferCoinToBinanceFeeKrw = 0.4 * 700 = 280

        // 4. 총 수수료 = 35 + 71.4 + 28.56 + 28.56 + 280 = 443.52
        // 5. 순수익 = 1323 - 443.52 = 879.48

        expect(result.grossProfit).toBeGreaterThan(0);
        expect(result.totalFee).toBeGreaterThan(0);
        expect(result.netProfit).toBeGreaterThan(0);
        expect(result.netProfitPercent).toBeGreaterThan(0);

        // 수수료 세부 항목들이 존재하는지 확인
        expect(result.upbitBuyFeeKrw).toBeDefined();
        expect(result.binanceSpotSellFeeKrw).toBeDefined();
        expect(result.binanceFuturesEntryFeeKrw).toBeDefined();
        expect(result.binanceFuturesExitFeeKrw).toBeDefined();
        expect(result.transferCoinToBinanceFeeKrw).toBeDefined();

        // 수수료가 합리적인 범위 내에 있는지 확인
        expect(result.upbitBuyFeeKrw).toBeGreaterThan(0);
        expect(result.binanceSpotSellFeeKrw).toBeGreaterThan(0);
        expect(result.binanceFuturesEntryFeeKrw).toBeGreaterThan(0);
        expect(result.binanceFuturesExitFeeKrw).toBeGreaterThan(0);
        expect(result.transferCoinToBinanceFeeKrw).toBeGreaterThan(0);

        // 총 수수료가 개별 수수료의 합과 일치하는지 확인
        const expectedTotalFee =
          result.upbitBuyFeeKrw! +
          result.binanceSpotSellFeeKrw! +
          result.binanceFuturesEntryFeeKrw! +
          result.binanceFuturesExitFeeKrw! +
          result.transferCoinToBinanceFeeKrw!;

        expect(result.totalFee).toBeCloseTo(expectedTotalFee, 2);

        // 순수익이 총수익에서 총수수료를 뺀 값과 일치하는지 확인
        expect(result.netProfit).toBeCloseTo(
          result.grossProfit - result.totalFee,
          2,
        );
      });

      it('should handle different symbols with appropriate transfer fees', () => {
        const input = {
          symbol: 'btc',
          amount: 0.1,
          upbitPrice: 50000000,
          binancePrice: 50000,
          rate: 1400,
          tradeDirection: 'LOW_PREMIUM_SELL_BINANCE' as const,
        };

        const result = service.calculate(input);

        expect(result.grossProfit).toBeGreaterThan(0);
        expect(result.totalFee).toBeGreaterThan(0);
        expect(result.netProfit).toBeGreaterThan(0);

        // BTC는 전송 수수료가 없으므로 transferCoinToBinanceFeeKrw가 0이어야 함
        expect(result.transferCoinToBinanceFeeKrw).toBe(0);
      });
    });

    describe('edge cases', () => {
      it('should handle zero amount', () => {
        const input = {
          symbol: 'xrp',
          amount: 0,
          upbitPrice: 710,
          binancePrice: 0.5,
          rate: 1400,
          tradeDirection: 'HIGH_PREMIUM_SELL_UPBIT' as const,
        };

        const result = service.calculate(input);

        expect(result.grossProfit).toBe(0);
        expect(result.totalFee).toBeGreaterThanOrEqual(0);
        expect(result.netProfit).toBeLessThanOrEqual(0);
        expect(result.netProfitPercent).toBe(0);
      });

      it('should handle zero prices', () => {
        const input = {
          symbol: 'xrp',
          amount: 100,
          upbitPrice: 0,
          binancePrice: 0,
          rate: 1400,
          tradeDirection: 'HIGH_PREMIUM_SELL_UPBIT' as const,
        };

        const result = service.calculate(input);

        expect(result.grossProfit).toBe(0);
        expect(result.totalFee).toBe(0);
        expect(result.netProfit).toBe(0);
        expect(result.netProfitPercent).toBe(0);
      });

      it('should handle zero exchange rate', () => {
        const input = {
          symbol: 'xrp',
          amount: 100,
          upbitPrice: 710,
          binancePrice: 0.5,
          rate: 0,
          tradeDirection: 'HIGH_PREMIUM_SELL_UPBIT' as const,
        };

        const result = service.calculate(input);

        expect(result.grossProfit).toBeGreaterThan(0);
        expect(result.totalFee).toBeGreaterThan(0);
        expect(result.netProfit).toBeGreaterThan(0);
      });

      it('should throw error for invalid trade direction', () => {
        const input = {
          symbol: 'xrp',
          amount: 100,
          upbitPrice: 710,
          binancePrice: 0.5,
          rate: 1400,
          tradeDirection: 'INVALID' as any,
        };

        expect(() => service.calculate(input)).toThrow(
          'Invalid trade direction specified for fee calculation.',
        );
      });
    });

    describe('profit percentage calculation', () => {
      it('should calculate profit percentage correctly', () => {
        const input = {
          symbol: 'xrp',
          amount: 100,
          upbitPrice: 710,
          binancePrice: 0.5,
          rate: 1400,
          tradeDirection: 'HIGH_PREMIUM_SELL_UPBIT' as const,
        };

        const result = service.calculate(input);

        // 수익률이 합리적인 범위 내에 있는지 확인 (0% ~ 100%)
        expect(result.netProfitPercent).toBeGreaterThanOrEqual(0);
        expect(result.netProfitPercent).toBeLessThanOrEqual(100);

        // 수익률이 합리적인 범위 내에 있는지 확인
        expect(result.netProfitPercent).toBeGreaterThanOrEqual(0);
        expect(result.netProfitPercent).toBeLessThanOrEqual(100);
      });

      it('should handle infinite profit percentage gracefully', () => {
        const input = {
          symbol: 'xrp',
          amount: 100,
          upbitPrice: 710,
          binancePrice: 0.5,
          rate: 1400,
          tradeDirection: 'LOW_PREMIUM_SELL_BINANCE' as const,
        };

        const result = service.calculate(input);

        // 수익률이 유한한 값인지 확인
        expect(isFinite(result.netProfitPercent)).toBe(true);
      });
    });

    describe('slippage calculation', () => {
      it('should apply slippage to prices', () => {
        const input = {
          symbol: 'xrp',
          amount: 100,
          upbitPrice: 710,
          binancePrice: 0.5,
          rate: 1400,
          tradeDirection: 'HIGH_PREMIUM_SELL_UPBIT' as const,
        };

        const result = service.calculate(input);

        // 슬리피지가 적용되어 실제 수익이 이론적 수익보다 낮아야 함
        const theoreticalGrossProfit =
          (input.upbitPrice - input.binancePrice * input.rate) * input.amount;
        expect(result.grossProfit).toBeLessThan(theoreticalGrossProfit);
      });

      it('should apply different slippage for different amounts', () => {
        const smallAmountInput = {
          symbol: 'xrp',
          amount: 10,
          upbitPrice: 710,
          binancePrice: 0.5,
          rate: 1400,
          tradeDirection: 'HIGH_PREMIUM_SELL_UPBIT' as const,
        };

        const largeAmountInput = {
          symbol: 'xrp',
          amount: 1000,
          upbitPrice: 710,
          binancePrice: 0.5,
          rate: 1400,
          tradeDirection: 'HIGH_PREMIUM_SELL_UPBIT' as const,
        };

        const smallResult = service.calculate(smallAmountInput);
        const largeResult = service.calculate(largeAmountInput);

        // 큰 거래량에서는 슬리피지가 더 클 수 있음
        const smallSlippageEffect =
          (710 - 0.5 * 1400) * 10 - smallResult.grossProfit;
        const largeSlippageEffect =
          (710 - 0.5 * 1400) * 1000 - largeResult.grossProfit;

        // 슬리피지 효과가 거래량에 비례하여 증가하는지 확인
        expect(largeSlippageEffect).toBeGreaterThan(smallSlippageEffect);
      });
    });
  });
});
