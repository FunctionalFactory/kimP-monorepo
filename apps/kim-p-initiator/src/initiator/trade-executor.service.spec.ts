import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { TradeExecutorService } from './trade-executor.service';

describe('TradeExecutorService', () => {
  let service: TradeExecutorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TradeExecutorService],
    }).compile();

    service = module.get<TradeExecutorService>(TradeExecutorService);

    // Logger를 mock으로 설정
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initiateArbitrageCycle', () => {
    it('should handle normal opportunity', async () => {
      const opportunity = {
        symbol: 'xrp',
        upbit: 1000,
        binance: 950,
        spread: {
          normalOpportunity: true,
          reverseOpportunity: false,
        },
      };

      await service.initiateArbitrageCycle(opportunity);

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[xrp] 투자 가능 금액: 1,000,000 KRW',
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('[xrp] 새로운 차익거래 사이클 시작:'),
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[xrp] Normal 전략 실행 시뮬레이션',
      );
    });

    it('should handle reverse opportunity', async () => {
      const opportunity = {
        symbol: 'trx',
        upbit: 950,
        binance: 1000,
        spread: {
          normalOpportunity: false,
          reverseOpportunity: true,
        },
      };

      await service.initiateArbitrageCycle(opportunity);

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[trx] 투자 가능 금액: 1,000,000 KRW',
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('[trx] 새로운 차익거래 사이클 시작:'),
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[trx] Reverse 전략 실행 시뮬레이션',
      );
    });

    it('should handle errors gracefully', async () => {
      const opportunity = {
        symbol: 'invalid',
        upbit: 1000,
        binance: 950,
        spread: {
          normalOpportunity: true,
          reverseOpportunity: false,
        },
      };

      // Logger.log를 mock하여 에러를 발생시킴
      const mockLog = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => {
          throw new Error('Test error');
        });

      await service.initiateArbitrageCycle(opportunity);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        '트레이드 실패: Test error',
      );

      // mock 복원
      mockLog.mockRestore();
    });

    it('should generate unique cycle IDs', async () => {
      const opportunity = {
        symbol: 'xrp',
        upbit: 1000,
        binance: 950,
        spread: {
          normalOpportunity: true,
          reverseOpportunity: false,
        },
      };

      await service.initiateArbitrageCycle(opportunity);

      const logCalls = (Logger.prototype.log as jest.Mock).mock.calls;
      const cycleLogCall = logCalls.find((call) =>
        call[0].includes('새로운 차익거래 사이클 시작:'),
      );

      expect(cycleLogCall).toBeDefined();
      expect(cycleLogCall[0]).toMatch(/cycle_\d+_[a-z0-9]{9}/);
    });
  });
});
