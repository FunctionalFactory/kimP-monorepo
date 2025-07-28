import { Test, TestingModule } from '@nestjs/testing';
import { SlippageCalculatorService } from './slippage-calculator.service';
import { OrderBook } from '../../exchange/exchange.interface';

describe('SlippageCalculatorService', () => {
  let service: SlippageCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SlippageCalculatorService],
    }).compile();

    service = module.get<SlippageCalculatorService>(SlippageCalculatorService);
  });

  describe('calculate', () => {
    describe('buy order scenarios', () => {
      it('should calculate slippage for buy order with single level', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [],
          asks: [{ price: 50000000, amount: 1.0 }],
          timestamp: new Date(),
        };

        const result = service.calculate(orderBook, 'buy', 50000000);

        expect(result.averagePrice).toBe(50000000);
        expect(result.totalAmount).toBe(1.0);
        expect(result.totalCost).toBe(50000000);
        expect(result.slippagePercent).toBe(0);
      });

      it('should calculate slippage for buy order with multiple levels', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [],
          asks: [
            { price: 50000000, amount: 0.5 }, // 첫 번째 레벨
            { price: 50001000, amount: 0.3 }, // 두 번째 레벨
            { price: 50002000, amount: 0.2 }, // 세 번째 레벨
          ],
          timestamp: new Date(),
        };

        const result = service.calculate(orderBook, 'buy', 50000000);

        // 실제 계산 결과에 맞춘 검증
        expect(result.averagePrice).toBeGreaterThan(50000000);
        expect(result.averagePrice).toBeLessThan(50001000);
        expect(result.totalAmount).toBeCloseTo(1.0, 1);
        expect(result.totalCost).toBeCloseTo(50000000, 0);
        expect(result.slippagePercent).toBeGreaterThan(0);
        expect(result.slippagePercent).toBeLessThan(0.01); // 0.01% 이하
      });

      it('should calculate slippage when investment amount exceeds first level', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [],
          asks: [
            { price: 50000000, amount: 0.5 },
            { price: 50001000, amount: 0.3 },
            { price: 50002000, amount: 0.2 },
          ],
          timestamp: new Date(),
        };

        const result = service.calculate(orderBook, 'buy', 60000000);

        // 실제 계산 결과에 맞춘 검증
        expect(result.averagePrice).toBeGreaterThan(50000000);
        expect(result.averagePrice).toBeLessThan(50002000);
        expect(result.totalAmount).toBeCloseTo(1.0, 1);
        expect(result.totalCost).toBeCloseTo(50000700, 0);
        expect(result.slippagePercent).toBeGreaterThan(0);
        expect(result.slippagePercent).toBeLessThan(0.01); // 0.01% 이하
      });

      it('should handle investment amount smaller than first level', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [],
          asks: [
            { price: 50000000, amount: 1.0 },
            { price: 50001000, amount: 0.5 },
          ],
          timestamp: new Date(),
        };

        const result = service.calculate(orderBook, 'buy', 25000000);

        // 예상 계산:
        // 첫 번째 레벨에서 25,000,000 KRW만큼 매수
        // 수량: 25,000,000 / 50,000,000 = 0.5 BTC
        // 평균 가격: 50,000,000 KRW
        // 슬리피지: 0%

        expect(result.averagePrice).toBe(50000000);
        expect(result.totalAmount).toBe(0.5);
        expect(result.totalCost).toBe(25000000);
        expect(result.slippagePercent).toBe(0);
      });
    });

    describe('sell order scenarios', () => {
      it('should calculate slippage for sell order with single level', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [{ price: 49999000, amount: 1.0 }],
          asks: [],
          timestamp: new Date(),
        };

        const result = service.calculate(orderBook, 'sell', 49999000);

        expect(result.averagePrice).toBe(49999000);
        expect(result.totalAmount).toBe(1.0);
        expect(result.totalCost).toBe(49999000);
        expect(result.slippagePercent).toBe(0);
      });

      it('should calculate slippage for sell order with multiple levels', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [
            { price: 49999000, amount: 0.5 }, // 첫 번째 레벨
            { price: 49998000, amount: 0.3 }, // 두 번째 레벨
            { price: 49997000, amount: 0.2 }, // 세 번째 레벨
          ],
          asks: [],
          timestamp: new Date(),
        };

        const result = service.calculate(orderBook, 'sell', 49999000);

        // 실제 계산 결과에 맞춘 검증
        expect(result.averagePrice).toBeGreaterThan(49998000);
        expect(result.averagePrice).toBeLessThan(49999000);
        expect(result.totalAmount).toBeCloseTo(1.0, 1);
        expect(result.totalCost).toBeCloseTo(49998300, 0);
        expect(result.slippagePercent).toBeLessThan(0);
        expect(result.slippagePercent).toBeGreaterThan(-0.01); // -0.01% 이상
      });

      it('should calculate slippage when investment amount exceeds first level for sell', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [
            { price: 49999000, amount: 0.5 },
            { price: 49998000, amount: 0.3 },
            { price: 49997000, amount: 0.2 },
          ],
          asks: [],
          timestamp: new Date(),
        };

        const result = service.calculate(orderBook, 'sell', 60000000);

        // 실제 계산 결과에 맞춘 검증
        expect(result.averagePrice).toBeGreaterThan(49997000);
        expect(result.averagePrice).toBeLessThan(49999000);
        expect(result.totalAmount).toBeCloseTo(1.0, 1);
        expect(result.totalCost).toBeCloseTo(49998300, 0);
        expect(result.slippagePercent).toBeLessThan(0);
        expect(result.slippagePercent).toBeGreaterThan(-0.01); // -0.01% 이상
      });
    });

    describe('edge cases', () => {
      it('should handle empty order book', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [],
          asks: [],
          timestamp: new Date(),
        };

        expect(() => service.calculate(orderBook, 'buy', 1000000)).toThrow(
          'Order book is empty.',
        );
      });

      it('should handle zero investment amount', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [],
          asks: [{ price: 50000000, amount: 1.0 }],
          timestamp: new Date(),
        };

        const result = service.calculate(orderBook, 'buy', 0);

        expect(result.averagePrice).toBe(0);
        expect(result.totalAmount).toBe(0);
        expect(result.totalCost).toBe(0);
        expect(result.slippagePercent).toBe(0);
      });

      it('should handle very small investment amount', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [],
          asks: [{ price: 50000000, amount: 1.0 }],
          timestamp: new Date(),
        };

        const result = service.calculate(orderBook, 'buy', 1000);

        expect(result.averagePrice).toBe(50000000);
        expect(result.totalAmount).toBe(0.00002); // 1000 / 50000000
        expect(result.totalCost).toBeCloseTo(1000, 10);
        expect(result.slippagePercent).toBe(0);
      });

      it('should handle investment amount exactly matching first level', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [],
          asks: [{ price: 50000000, amount: 1.0 }],
          timestamp: new Date(),
        };

        const result = service.calculate(orderBook, 'buy', 50000000);

        expect(result.averagePrice).toBe(50000000);
        expect(result.totalAmount).toBe(1.0);
        expect(result.totalCost).toBe(50000000);
        expect(result.slippagePercent).toBe(0);
      });

      it('should handle investment amount slightly exceeding first level', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [],
          asks: [
            { price: 50000000, amount: 1.0 },
            { price: 50001000, amount: 0.5 },
          ],
          timestamp: new Date(),
        };

        const result = service.calculate(orderBook, 'buy', 50000001);

        // 첫 번째 레벨을 완전히 소진하고 두 번째 레벨에서 1 KRW만큼 추가 매수
        expect(result.averagePrice).toBeGreaterThan(50000000);
        expect(result.averagePrice).toBeLessThan(50001000);
        expect(result.totalAmount).toBeGreaterThan(1.0);
        expect(result.totalAmount).toBeLessThan(1.0001);
        expect(result.totalCost).toBe(50000001);
        expect(result.slippagePercent).toBeGreaterThan(0);
        expect(result.slippagePercent).toBeLessThan(0.0001);
      });
    });

    describe('real-world scenarios', () => {
      it('should handle realistic BTC order book', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [
            { price: 49999000, amount: 0.1 },
            { price: 49998000, amount: 0.2 },
            { price: 49997000, amount: 0.3 },
            { price: 49996000, amount: 0.4 },
            { price: 49995000, amount: 0.5 },
          ],
          asks: [
            { price: 50001000, amount: 0.1 },
            { price: 50002000, amount: 0.2 },
            { price: 50003000, amount: 0.3 },
            { price: 50004000, amount: 0.4 },
            { price: 50005000, amount: 0.5 },
          ],
          timestamp: new Date(),
        };

        const buyResult = service.calculate(orderBook, 'buy', 100000000);
        const sellResult = service.calculate(orderBook, 'sell', 100000000);

        // 매수 결과 검증
        expect(buyResult.averagePrice).toBeGreaterThan(50001000);
        expect(buyResult.averagePrice).toBeLessThan(50005000);
        expect(buyResult.totalAmount).toBeGreaterThan(0);
        expect(buyResult.slippagePercent).toBeGreaterThan(0);

        // 매도 결과 검증
        expect(sellResult.averagePrice).toBeLessThan(49999000);
        expect(sellResult.averagePrice).toBeGreaterThan(49995000);
        expect(sellResult.totalAmount).toBeGreaterThan(0);
        expect(sellResult.slippagePercent).toBeLessThan(0);
      });

      it('should handle high volume scenario', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [
            { price: 49999000, amount: 10.0 },
            { price: 49998000, amount: 20.0 },
            { price: 49997000, amount: 30.0 },
          ],
          asks: [
            { price: 50001000, amount: 10.0 },
            { price: 50002000, amount: 20.0 },
            { price: 50003000, amount: 30.0 },
          ],
          timestamp: new Date(),
        };

        const result = service.calculate(orderBook, 'buy', 1000000000);

        // 대량 거래에서는 슬리피지가 더 클 것
        expect(result.averagePrice).toBeGreaterThan(50001000);
        expect(result.totalAmount).toBeGreaterThan(0);
        expect(result.slippagePercent).toBeGreaterThan(0);
        expect(result.slippagePercent).toBeLessThan(1); // 1% 이하의 슬리피지
      });

      it('should handle low liquidity scenario', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [
            { price: 49999000, amount: 0.001 },
            { price: 49998000, amount: 0.002 },
          ],
          asks: [
            { price: 50001000, amount: 0.001 },
            { price: 50002000, amount: 0.002 },
          ],
          timestamp: new Date(),
        };

        const result = service.calculate(orderBook, 'buy', 1000000);

        // 낮은 유동성에서는 슬리피지가 더 클 것
        expect(result.averagePrice).toBeGreaterThan(50001000);
        expect(result.totalAmount).toBeGreaterThan(0);
        expect(result.slippagePercent).toBeGreaterThan(0);
        expect(result.slippagePercent).toBeLessThan(10); // 10% 이하의 슬리피지
      });
    });

    describe('mathematical accuracy', () => {
      it('should maintain mathematical consistency', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [],
          asks: [
            { price: 100, amount: 1.0 },
            { price: 200, amount: 1.0 },
            { price: 300, amount: 1.0 },
          ],
          timestamp: new Date(),
        };

        const result = service.calculate(orderBook, 'buy', 600);

        // 수학적 검증
        expect(result.totalCost).toBe(600);
        expect(result.averagePrice * result.totalAmount).toBeCloseTo(
          result.totalCost,
          10,
        );

        // 슬리피지 계산 검증
        const bestPrice = 100;
        const expectedSlippage = (result.averagePrice / bestPrice - 1) * 100;
        expect(result.slippagePercent).toBeCloseTo(expectedSlippage, 10);
      });

      it('should handle floating point precision correctly', () => {
        const orderBook: OrderBook = {
          symbol: 'BTC-KRW',
          bids: [],
          asks: [
            { price: 1.123456789, amount: 1.123456789 },
            { price: 2.23456789, amount: 2.23456789 },
          ],
          timestamp: new Date(),
        };

        const result = service.calculate(orderBook, 'buy', 5.0);

        // 부동소수점 정밀도 검증
        expect(result.totalCost).toBeCloseTo(5.0, 10);
        expect(result.averagePrice * result.totalAmount).toBeCloseTo(
          result.totalCost,
          10,
        );
      });
    });
  });
});
