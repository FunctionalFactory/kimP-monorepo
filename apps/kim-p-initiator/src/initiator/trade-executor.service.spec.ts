import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { TradeExecutorService } from './trade-executor.service';
import { ArbitrageOpportunity } from './opportunity-scanner.service';
import {
  ArbitrageRecordService,
  PortfolioManagerService,
  LoggingService,
  ErrorHandlerService,
  DistributedLockService,
  StrategyHighService,
  StrategyLowService,
} from '@app/kimp-core';

describe('TradeExecutorService', () => {
  let service: TradeExecutorService;
  let arbitrageRecordService: jest.Mocked<ArbitrageRecordService>;
  let portfolioManagerService: jest.Mocked<PortfolioManagerService>;
  let loggingService: jest.Mocked<LoggingService>;
  let errorHandlerService: jest.Mocked<ErrorHandlerService>;
  let distributedLockService: jest.Mocked<DistributedLockService>;
  let strategyHighService: jest.Mocked<StrategyHighService>;
  let strategyLowService: jest.Mocked<StrategyLowService>;

  const mockOpportunity: ArbitrageOpportunity = {
    symbol: 'xrp',
    upbitPrice: 1000,
    binancePrice: 950,
    spreadPercent: 5.26,
    isNormalOpportunity: true,
    netProfitPercent: 3.5,
  };

  beforeEach(async () => {
    const mockArbitrageRecordService = {
      createArbitrageCycle: jest.fn(),
      createTrade: jest.fn(),
      updateArbitrageCycle: jest.fn(),
    };

    const mockPortfolioManagerService = {
      getCurrentInvestmentAmount: jest.fn(),
    };

    const mockLoggingService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockErrorHandlerService = {
      handleError: jest.fn(),
    };

    const mockDistributedLockService = {
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
    };

    const mockStrategyHighService = {
      handleHighPremiumFlow: jest.fn(),
    };

    const mockStrategyLowService = {
      handleLowPremiumFlow: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeExecutorService,
        {
          provide: ArbitrageRecordService,
          useValue: mockArbitrageRecordService,
        },
        {
          provide: PortfolioManagerService,
          useValue: mockPortfolioManagerService,
        },
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
        {
          provide: ErrorHandlerService,
          useValue: mockErrorHandlerService,
        },
        {
          provide: DistributedLockService,
          useValue: mockDistributedLockService,
        },
        {
          provide: StrategyHighService,
          useValue: mockStrategyHighService,
        },
        {
          provide: StrategyLowService,
          useValue: mockStrategyLowService,
        },
      ],
    }).compile();

    service = module.get<TradeExecutorService>(TradeExecutorService);
    arbitrageRecordService = module.get(ArbitrageRecordService);
    portfolioManagerService = module.get(PortfolioManagerService);
    loggingService = module.get(LoggingService);
    errorHandlerService = module.get(ErrorHandlerService);
    distributedLockService = module.get(DistributedLockService);
    strategyHighService = module.get(StrategyHighService);
    strategyLowService = module.get(StrategyLowService);

    // Logger를 mock으로 설정
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initiateArbitrageCycle', () => {
    it('should handle normal opportunity successfully', async () => {
      // DistributedLockService mock 설정
      distributedLockService.acquireLock.mockResolvedValue(true);
      distributedLockService.releaseLock.mockResolvedValue();

      // PortfolioManagerService mock 설정
      portfolioManagerService.getCurrentInvestmentAmount.mockResolvedValue(
        1000000,
      );

      // ArbitrageRecordService mock 설정
      arbitrageRecordService.createArbitrageCycle.mockResolvedValue({
        id: 'test-cycle-id',
        initialInvestmentKrw: 1000000,
        totalNetProfitPercent: 3.5,
        status: 'AWAITING_REBALANCE',
      } as any);

      arbitrageRecordService.createTrade.mockResolvedValue({
        id: 'test-trade-id',
        cycleId: 'test-cycle-id',
        tradeType: 'HIGH_PREMIUM_BUY',
        symbol: 'xrp',
        status: 'COMPLETED',
        investmentKrw: 1000000,
        netProfitKrw: 35000,
      } as any);

      // StrategyHighService mock 설정
      strategyHighService.handleHighPremiumFlow.mockResolvedValue(true);

      await service.initiateArbitrageCycle(mockOpportunity);

      expect(
        portfolioManagerService.getCurrentInvestmentAmount,
      ).toHaveBeenCalled();
      expect(arbitrageRecordService.createArbitrageCycle).toHaveBeenCalledWith({
        initialInvestmentKrw: 1000000,
        totalNetProfitPercent: 3.5,
        status: 'AWAITING_REBALANCE',
      });
      expect(arbitrageRecordService.createTrade).toHaveBeenCalledWith({
        cycleId: 'test-cycle-id',
        tradeType: 'HIGH_PREMIUM_BUY',
        symbol: 'xrp',
        status: 'COMPLETED',
        investmentKrw: 1000000,
        netProfitKrw: 35000, // 1000000 * 3.5 / 100
        details: {
          upbitPrice: 1000,
          binancePrice: 950,
          spreadPercent: 5.26,
          marketDirection: 'NORMAL',
          netProfitPercent: 3.5,
        },
      });
      expect(strategyHighService.handleHighPremiumFlow).toHaveBeenCalledWith({
        symbol: 'xrp',
        investmentAmount: 1000000,
        upbitPrice: 1000,
        binancePrice: 950,
        cycleId: 'test-cycle-id',
      });
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[xrp] 자금 확인 완료 - 투자 가능 금액: 1,000,000 KRW',
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[xrp] 새로운 차익거래 사이클 시작: test-cycle-id, 초기 거래: test-trade-id',
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[xrp] HIGH_PREMIUM 전략 실행',
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith('[xrp] 전략 실행 완료');
    });

    it('should handle reverse opportunity successfully', async () => {
      // DistributedLockService mock 설정
      distributedLockService.acquireLock.mockResolvedValue(true);
      distributedLockService.releaseLock.mockResolvedValue();

      const reverseOpportunity: ArbitrageOpportunity = {
        symbol: 'trx',
        upbitPrice: 950,
        binancePrice: 1000,
        spreadPercent: 5.26,
        isNormalOpportunity: false,
        netProfitPercent: 2.5,
      };

      portfolioManagerService.getCurrentInvestmentAmount.mockResolvedValue(
        500000,
      );

      arbitrageRecordService.createArbitrageCycle.mockResolvedValue({
        id: 'test-cycle-id-2',
        initialInvestmentKrw: 500000,
        totalNetProfitPercent: 2.5,
        status: 'AWAITING_REBALANCE',
      } as any);

      arbitrageRecordService.createTrade.mockResolvedValue({
        id: 'test-trade-id-2',
        cycleId: 'test-cycle-id-2',
        tradeType: 'LOW_PREMIUM_BUY',
        symbol: 'trx',
        status: 'COMPLETED',
        investmentKrw: 500000,
        netProfitKrw: 12500,
      } as any);

      // StrategyLowService mock 설정
      strategyLowService.handleLowPremiumFlow.mockResolvedValue(true);

      await service.initiateArbitrageCycle(reverseOpportunity);

      expect(strategyLowService.handleLowPremiumFlow).toHaveBeenCalledWith({
        symbol: 'trx',
        investmentAmount: 500000,
        upbitPrice: 950,
        binancePrice: 1000,
        cycleId: 'test-cycle-id-2',
      });
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[trx] 새로운 차익거래 사이클 시작: test-cycle-id-2, 초기 거래: test-trade-id-2',
      );
    });

    it('should stop execution when insufficient funds', async () => {
      // DistributedLockService mock 설정
      distributedLockService.acquireLock.mockResolvedValue(true);
      distributedLockService.releaseLock.mockResolvedValue();

      portfolioManagerService.getCurrentInvestmentAmount.mockResolvedValue(0);

      await service.initiateArbitrageCycle(mockOpportunity);

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        '[xrp] 투자 가능 자금이 부족합니다: 0 KRW',
      );
      expect(
        arbitrageRecordService.createArbitrageCycle,
      ).not.toHaveBeenCalled();
      expect(arbitrageRecordService.createTrade).not.toHaveBeenCalled();
    });

    it('should handle distributed lock acquisition failure', async () => {
      distributedLockService.acquireLock.mockResolvedValue(false);

      await service.initiateArbitrageCycle(mockOpportunity);

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        '[xrp] 중복 처리 방지: 이미 처리 중인 기회입니다',
      );
      expect(
        portfolioManagerService.getCurrentInvestmentAmount,
      ).not.toHaveBeenCalled();
      expect(
        arbitrageRecordService.createArbitrageCycle,
      ).not.toHaveBeenCalled();
    });

    it('should handle strategy execution failure', async () => {
      // DistributedLockService mock 설정
      distributedLockService.acquireLock.mockResolvedValue(true);
      distributedLockService.releaseLock.mockResolvedValue();

      portfolioManagerService.getCurrentInvestmentAmount.mockResolvedValue(
        1000000,
      );

      arbitrageRecordService.createArbitrageCycle.mockResolvedValue({
        id: 'test-cycle-id',
        initialInvestmentKrw: 1000000,
        totalNetProfitPercent: 3.5,
        status: 'AWAITING_REBALANCE',
      } as any);

      arbitrageRecordService.createTrade.mockResolvedValue({
        id: 'test-trade-id',
        cycleId: 'test-cycle-id',
        tradeType: 'HIGH_PREMIUM_BUY',
        symbol: 'xrp',
        status: 'COMPLETED',
        investmentKrw: 1000000,
        netProfitKrw: 35000,
      } as any);

      // StrategyHighService mock 설정 - 실패 시나리오
      strategyHighService.handleHighPremiumFlow.mockResolvedValue(false);

      await service.initiateArbitrageCycle(mockOpportunity);

      expect(errorHandlerService.handleError).toHaveBeenCalledWith({
        error: expect.any(Error),
        severity: 'HIGH',
        category: 'BUSINESS_LOGIC',
        context: {
          cycleId: 'test-cycle-id',
          symbol: 'xrp',
          stage: 'STRATEGY_EXECUTION',
        },
      });

      expect(arbitrageRecordService.updateArbitrageCycle).toHaveBeenCalledWith(
        'test-cycle-id',
        {
          status: 'FAILED',
          errorDetails: '전략 실행 실패: 전략 실행 실패',
        },
      );
    });

    it('should handle database errors gracefully', async () => {
      // DistributedLockService mock 설정
      distributedLockService.acquireLock.mockResolvedValue(true);
      distributedLockService.releaseLock.mockResolvedValue();

      portfolioManagerService.getCurrentInvestmentAmount.mockResolvedValue(
        1000000,
      );
      arbitrageRecordService.createArbitrageCycle.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await service.initiateArbitrageCycle(mockOpportunity);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        '[xrp] 차익거래 사이클 시작 실패: Database connection failed',
      );
      expect(loggingService.error).toHaveBeenCalledWith(
        '차익거래 사이클 시작 중 오류 발생',
        expect.any(Error),
        {
          service: 'TradeExecutorService',
          symbol: 'xrp',
        },
      );
    });

    it('should handle portfolio manager errors gracefully', async () => {
      // DistributedLockService mock 설정
      distributedLockService.acquireLock.mockResolvedValue(true);
      distributedLockService.releaseLock.mockResolvedValue();

      portfolioManagerService.getCurrentInvestmentAmount.mockRejectedValue(
        new Error('Portfolio service unavailable'),
      );

      await service.initiateArbitrageCycle(mockOpportunity);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        '[xrp] 차익거래 사이클 시작 실패: Portfolio service unavailable',
      );
      expect(loggingService.error).toHaveBeenCalledWith(
        '차익거래 사이클 시작 중 오류 발생',
        expect.any(Error),
        {
          service: 'TradeExecutorService',
          symbol: 'xrp',
        },
      );
    });

    it('should always release lock in finally block', async () => {
      // DistributedLockService mock 설정
      distributedLockService.acquireLock.mockResolvedValue(true);
      distributedLockService.releaseLock.mockResolvedValue();

      // 에러 발생 시나리오
      portfolioManagerService.getCurrentInvestmentAmount.mockRejectedValue(
        new Error('Test error'),
      );

      await service.initiateArbitrageCycle(mockOpportunity);

      expect(distributedLockService.releaseLock).toHaveBeenCalledWith(
        'lock:xrp',
      );
      expect(Logger.prototype.debug).toHaveBeenCalledWith(
        '[xrp] 분산 잠금 해제: lock:xrp',
      );
    });
  });
});
