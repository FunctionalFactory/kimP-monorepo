import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { FinalizerService } from './finalizer.service';
import { ArbitrageRecordService } from '@app/kimp-core';
import { RetryManagerService } from '@app/kimp-core';
import { PortfolioLogService } from '@app/kimp-core';
import { SpreadCalculatorService } from '@app/kimp-core';
import { StrategyHighService } from '@app/kimp-core';
import { StrategyLowService } from '@app/kimp-core';
import { ArbitrageCycle } from '@app/kimp-core';

describe('FinalizerService', () => {
  let service: FinalizerService;
  let arbitrageRecordService: jest.Mocked<ArbitrageRecordService>;
  let retryManagerService: jest.Mocked<RetryManagerService>;
  let portfolioLogService: jest.Mocked<PortfolioLogService>;
  let spreadCalculatorService: jest.Mocked<SpreadCalculatorService>;
  let strategyHighService: jest.Mocked<StrategyHighService>;
  let strategyLowService: jest.Mocked<StrategyLowService>;

  const mockCycle: Partial<ArbitrageCycle> = {
    id: 'test-cycle-id',
    status: 'AWAITING_REBALANCE',
    initialTradeId: 'initial-trade-id',
    totalNetProfitKrw: 10000,
    totalNetProfitPercent: 1.5,
    initialInvestmentKrw: 1000000,
    retryCount: 0,
  };

  const mockRebalanceResult = {
    success: true,
    tradeId: 'rebalance-trade-id',
    totalProfit: 10000,
    finalBalance: 1010000,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinalizerService,
        {
          provide: ArbitrageRecordService,
          useValue: {
            findAndLockNextCycle: jest.fn(),
            updateArbitrageCycle: jest.fn(),
            getCycleWithTrades: jest.fn(),
            createTrade: jest.fn(),
          },
        },
        {
          provide: RetryManagerService,
          useValue: {
            handleCycleFailure: jest.fn(),
          },
        },
        {
          provide: PortfolioLogService,
          useValue: {
            createLog: jest.fn(),
          },
        },
        {
          provide: SpreadCalculatorService,
          useValue: {
            calculateSpread: jest.fn(),
            getMarketState: jest.fn(),
          },
        },
        {
          provide: StrategyHighService,
          useValue: {
            handleHighPremiumFlow: jest.fn(),
          },
        },
        {
          provide: StrategyLowService,
          useValue: {
            handleLowPremiumFlow: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FinalizerService>(FinalizerService);
    arbitrageRecordService = module.get(ArbitrageRecordService);
    retryManagerService = module.get(RetryManagerService);
    portfolioLogService = module.get(PortfolioLogService);
    spreadCalculatorService = module.get(SpreadCalculatorService);
    strategyHighService = module.get(StrategyHighService);
    strategyLowService = module.get(StrategyLowService);

    // Logger 모킹
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processPendingCycles', () => {
    describe('Scenario 1: Happy Path - Cycle Completion', () => {
      it('should successfully complete a cycle when all steps succeed', async () => {
        // Arrange
        arbitrageRecordService.findAndLockNextCycle.mockResolvedValue(
          mockCycle as ArbitrageCycle,
        );
        arbitrageRecordService.getCycleWithTrades.mockResolvedValue(
          mockCycle as ArbitrageCycle,
        );
        spreadCalculatorService.getMarketState.mockReturnValue({
          symbol: 'BTC',
          upbitPrice: 50000000,
          binancePrice: 49000000,
          rate: 1300,
          binancePriceKRW: 63700000,
          rawPremiumPercent: 2.0,
          marketState: 'NORMAL',
          timestamp: new Date(),
        });
        spreadCalculatorService.calculateSpread.mockResolvedValue({
          symbol: 'BTC',
          upbitPrice: 50000000,
          binancePrice: 49000000,
          spreadPercent: 2.0,
          isNormalOpportunity: true,
          netProfitPercent: 1.5,
          totalFee: 5000,
          slippageImpact: 0.1,
          volumeCheck: true,
        });
        strategyHighService.handleHighPremiumFlow.mockResolvedValue(true);
        arbitrageRecordService.createTrade.mockResolvedValue({
          id: 'rebalance-trade-id',
          tradeType: 'REBALANCE',
          status: 'COMPLETED',
        } as any);
        portfolioLogService.createLog.mockResolvedValue({
          id: 'portfolio-log-id',
          total_balance_krw: 1010000,
          cycle_pnl_krw: 10000,
        } as any);

        // Act
        await service.processPendingCycles();

        // Assert
        expect(
          arbitrageRecordService.findAndLockNextCycle,
        ).toHaveBeenCalledWith();
        expect(
          arbitrageRecordService.updateArbitrageCycle,
        ).toHaveBeenCalledWith(
          mockCycle.id,
          expect.objectContaining({
            status: 'COMPLETED',
            rebalanceTradeId: 'rebalance-trade-id',
          }),
        );
        expect(portfolioLogService.createLog).toHaveBeenCalledWith(
          expect.objectContaining({
            linked_arbitrage_cycle_id: mockCycle.id,
            cycle_pnl_krw: 15000, // 실제 계산된 값
          }),
        );
      });
    });

    describe('Scenario 2: No Pending Cycles', () => {
      it('should exit gracefully when no pending cycles are found', async () => {
        // Arrange
        arbitrageRecordService.findAndLockNextCycle.mockResolvedValue(null);

        // Act
        await service.processPendingCycles();

        // Assert
        expect(
          arbitrageRecordService.findAndLockNextCycle,
        ).toHaveBeenCalledWith();
        expect(
          arbitrageRecordService.updateArbitrageCycle,
        ).not.toHaveBeenCalled();
        expect(portfolioLogService.createLog).not.toHaveBeenCalled();
        expect(retryManagerService.handleCycleFailure).not.toHaveBeenCalled();
      });
    });

    describe('Scenario 3: Trade Execution Fails', () => {
      it('should handle cycle failure when trade execution throws an error', async () => {
        // Arrange
        const tradeError = new Error('Trade execution failed');
        arbitrageRecordService.findAndLockNextCycle.mockResolvedValue(
          mockCycle as ArbitrageCycle,
        );
        arbitrageRecordService.getCycleWithTrades.mockResolvedValue(
          mockCycle as ArbitrageCycle,
        );
        spreadCalculatorService.getMarketState.mockReturnValue({
          symbol: 'BTC',
          upbitPrice: 50000000,
          binancePrice: 49000000,
          rate: 1300,
          binancePriceKRW: 63700000,
          rawPremiumPercent: 2.0,
          marketState: 'NORMAL',
          timestamp: new Date(),
        });
        spreadCalculatorService.calculateSpread.mockResolvedValue({
          symbol: 'BTC',
          upbitPrice: 50000000,
          binancePrice: 49000000,
          spreadPercent: 2.0,
          isNormalOpportunity: true,
          netProfitPercent: 1.5,
          totalFee: 5000,
          slippageImpact: 0.1,
          volumeCheck: true,
        });
        strategyHighService.handleHighPremiumFlow.mockRejectedValue(tradeError);

        // Act
        await service.processPendingCycles();

        // Assert
        expect(
          arbitrageRecordService.findAndLockNextCycle,
        ).toHaveBeenCalledWith();
        expect(retryManagerService.handleCycleFailure).toHaveBeenCalledWith(
          mockCycle as ArbitrageCycle,
          expect.objectContaining({
            message: expect.stringContaining('재균형 거래 실패'),
          }),
        );
        expect(
          arbitrageRecordService.updateArbitrageCycle,
        ).not.toHaveBeenCalledWith(
          mockCycle.id,
          expect.objectContaining({ status: 'COMPLETED' }),
        );
      });
    });

    describe('Scenario 4: No Profitable Rebalance Option', () => {
      it('should handle gracefully when no profitable rebalance options are found', async () => {
        // Arrange
        arbitrageRecordService.findAndLockNextCycle.mockResolvedValue(
          mockCycle as ArbitrageCycle,
        );
        arbitrageRecordService.getCycleWithTrades.mockResolvedValue(
          mockCycle as ArbitrageCycle,
        );
        spreadCalculatorService.getMarketState.mockReturnValue({
          symbol: 'BTC',
          upbitPrice: 50000000,
          binancePrice: 49000000,
          rate: 1300,
          binancePriceKRW: 63700000,
          rawPremiumPercent: 2.0,
          marketState: 'NORMAL',
          timestamp: new Date(),
        });
        spreadCalculatorService.calculateSpread.mockResolvedValue(null); // 수익성 없는 옵션

        // Act
        await service.processPendingCycles();

        // Assert
        expect(
          arbitrageRecordService.findAndLockNextCycle,
        ).toHaveBeenCalledWith();
        expect(spreadCalculatorService.calculateSpread).toHaveBeenCalled();
        expect(
          strategyHighService.handleHighPremiumFlow,
        ).not.toHaveBeenCalled();
        expect(strategyLowService.handleLowPremiumFlow).not.toHaveBeenCalled();
        expect(
          arbitrageRecordService.updateArbitrageCycle,
        ).not.toHaveBeenCalledWith(
          mockCycle.id,
          expect.objectContaining({ status: 'COMPLETED' }),
        );
        // 로그 경고가 기록되었는지 확인
        expect(Logger.prototype.warn).toHaveBeenCalledWith(
          expect.stringContaining('수익성 있는 재균형 옵션을 찾을 수 없습니다'),
        );
      });
    });

    describe('Additional Edge Cases', () => {
      it('should handle database errors gracefully', async () => {
        // Arrange
        const dbError = new Error('Database connection failed');
        arbitrageRecordService.findAndLockNextCycle.mockRejectedValue(dbError);

        // Act
        await service.processPendingCycles();

        // Assert
        expect(Logger.prototype.error).toHaveBeenCalledWith(
          expect.stringContaining('사이클 처리 중 오류 발생'),
        );
      });

      it('should handle strategy service errors for low premium flow', async () => {
        // Arrange
        arbitrageRecordService.findAndLockNextCycle.mockResolvedValue(
          mockCycle as ArbitrageCycle,
        );
        arbitrageRecordService.getCycleWithTrades.mockResolvedValue(
          mockCycle as ArbitrageCycle,
        );
        spreadCalculatorService.getMarketState.mockReturnValue({
          symbol: 'BTC',
          upbitPrice: 49000000,
          binancePrice: 50000000,
          rate: 1300,
          binancePriceKRW: 65000000,
          rawPremiumPercent: -2.0,
          marketState: 'REVERSE',
          timestamp: new Date(),
        });
        spreadCalculatorService.calculateSpread.mockResolvedValue({
          symbol: 'BTC',
          upbitPrice: 49000000,
          binancePrice: 50000000,
          spreadPercent: 2.0,
          isNormalOpportunity: false, // LOW_PREMIUM
          netProfitPercent: 1.5,
          totalFee: 5000,
          slippageImpact: 0.1,
          volumeCheck: true,
        });
        const strategyError = new Error('Low premium strategy failed');
        strategyLowService.handleLowPremiumFlow.mockRejectedValue(
          strategyError,
        );

        // Act
        await service.processPendingCycles();

        // Assert
        expect(retryManagerService.handleCycleFailure).toHaveBeenCalledWith(
          mockCycle as ArbitrageCycle,
          expect.objectContaining({
            message: expect.stringContaining('재균형 거래 실패'),
          }),
        );
      });

      it('should handle portfolio log creation errors', async () => {
        // Arrange
        arbitrageRecordService.findAndLockNextCycle.mockResolvedValue(
          mockCycle as ArbitrageCycle,
        );
        arbitrageRecordService.getCycleWithTrades.mockResolvedValue(
          mockCycle as ArbitrageCycle,
        );
        spreadCalculatorService.getMarketState.mockReturnValue({
          symbol: 'BTC',
          upbitPrice: 50000000,
          binancePrice: 49000000,
          rate: 1300,
          binancePriceKRW: 63700000,
          rawPremiumPercent: 2.0,
          marketState: 'NORMAL',
          timestamp: new Date(),
        });
        spreadCalculatorService.calculateSpread.mockResolvedValue({
          symbol: 'BTC',
          upbitPrice: 50000000,
          binancePrice: 49000000,
          spreadPercent: 2.0,
          isNormalOpportunity: true,
          netProfitPercent: 1.5,
          totalFee: 5000,
          slippageImpact: 0.1,
          volumeCheck: true,
        });
        strategyHighService.handleHighPremiumFlow.mockResolvedValue(true);
        arbitrageRecordService.createTrade.mockResolvedValue({
          id: 'rebalance-trade-id',
          tradeType: 'REBALANCE',
          status: 'COMPLETED',
        } as any);
        const portfolioError = new Error('Portfolio log creation failed');
        portfolioLogService.createLog.mockRejectedValue(portfolioError);

        // Act
        await service.processPendingCycles();

        // Assert
        expect(Logger.prototype.error).toHaveBeenCalledWith(
          expect.stringContaining('사이클 test-cycle-id 처리 실패'),
        );
      });
    });
  });
});
