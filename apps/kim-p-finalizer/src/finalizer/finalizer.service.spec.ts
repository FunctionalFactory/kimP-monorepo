import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { FinalizerService } from './finalizer.service';

describe('FinalizerService', () => {
  let service: FinalizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FinalizerService],
    }).compile();

    service = module.get<FinalizerService>(FinalizerService);

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processPendingCycles', () => {
    it('should process a simulated cycle and log success', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      await service.processPendingCycles();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('시뮬레이션 사이클 발견:'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ 시뮬레이션 사이클 처리 완료:'),
      );
    });

    it('should handle errors in processCycle', async () => {
      // processCycle을 강제로 에러 발생시키도록 mock
      const error = new Error('Test error');
      jest
        .spyOn<any, any>(service as any, 'processCycle')
        .mockRejectedValue(error);
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      await service.processPendingCycles();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ 시뮬레이션 사이클 처리 실패: Test error'),
      );
    });
  });

  describe('executeRebalanceTrade', () => {
    it('should return success result', async () => {
      const cycle = { strategy: 'HIGH' };
      const result = await (service as any).executeRebalanceTrade(cycle, 1000);
      expect(result.success).toBe(true);
      expect(result.tradeId).toMatch(/rebalance_\d+_[a-z0-9]{9}/);
      expect(result.totalProfit).toBe(10000);
    });

    it('should return success result with correct structure', async () => {
      const cycle = { strategy: 'HIGH' };
      const result = await (service as any).executeRebalanceTrade(cycle, 1000);
      expect(result.success).toBe(true);
      expect(result.tradeId).toMatch(/rebalance_\d+_[a-z0-9]{9}/);
      expect(result.totalProfit).toBe(10000);
      expect(result.finalBalance).toBe(1010000);
    });
  });
});
