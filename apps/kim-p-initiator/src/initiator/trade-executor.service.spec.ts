import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { TradeExecutorService } from './trade-executor.service';
import { ArbitrageOpportunity } from './opportunity-scanner.service';
import {
  ArbitrageRecordService,
  PortfolioManagerService,
  LoggingService,
  ErrorHandlerService,
} from '@app/kimp-core';

describe('TradeExecutorService', () => {
  let service: TradeExecutorService;
  let arbitrageRecordService: jest.Mocked<ArbitrageRecordService>;
  let portfolioManagerService: jest.Mocked<PortfolioManagerService>;
  let loggingService: jest.Mocked<LoggingService>;
  let errorHandlerService: jest.Mocked<ErrorHandlerService>;

  beforeEach(async () => {
    const mockArbitrageRecordService = {
      createArbitrageCycle: jest.fn(),
      createTrade: jest.fn(),
    };

    const mockPortfolioManagerService = {
      getCurrentInvestmentAmount: jest.fn(),
    };

    const mockLoggingService = {
      info: jest.fn(),
      error: jest.fn(),
    };

    const mockErrorHandlerService = {
      handleError: jest.fn(),
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
      ],
    }).compile();

    service = module.get<TradeExecutorService>(TradeExecutorService);
    arbitrageRecordService = module.get(ArbitrageRecordService);
    portfolioManagerService = module.get(PortfolioManagerService);
    loggingService = module.get(LoggingService);
    errorHandlerService = module.get(ErrorHandlerService);

    // Logger를 mock으로 설정
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initiateArbitrageCycle', () => {
    const mockOpportunity: ArbitrageOpportunity = {
      symbol: 'xrp',
      upbitPrice: 1000,
      binancePrice: 950,
      spreadPercent: 5.0,
      isNormalOpportunity: true,
      netProfitPercent: 3.5,
    };

    it('should handle normal opportunity successfully', async () => {
      // PortfolioManagerService mock 설정
      portfolioManagerService.getCurrentInvestmentAmount.mockResolvedValue(
        1000000,
      );

      // ArbitrageRecordService mock 설정
      arbitrageRecordService.createArbitrageCycle.mockResolvedValue({
        id: 'test-cycle-id',
        status: 'STARTED',
        initialInvestmentKrw: 1000000,
        totalNetProfitPercent: 3.5,
      } as any);

      arbitrageRecordService.createTrade.mockResolvedValue({
        id: 'test-trade-id',
        cycleId: 'test-cycle-id',
        tradeType: 'HIGH_PREMIUM_BUY',
        symbol: 'xrp',
        status: 'PENDING',
      } as any);

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
          spreadPercent: 5.0,
          marketDirection: 'NORMAL',
          netProfitPercent: 3.5,
        },
      });
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[xrp] 투자 가능 금액: 1,000,000 KRW',
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[xrp] 새로운 차익거래 사이클 시작: test-cycle-id',
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[xrp] Normal 전략 실행',
      );
    });

    it('should handle reverse opportunity successfully', async () => {
      const reverseOpportunity: ArbitrageOpportunity = {
        symbol: 'trx',
        upbitPrice: 950,
        binancePrice: 1000,
        spreadPercent: 5.0,
        isNormalOpportunity: false,
        netProfitPercent: 2.5,
      };

      portfolioManagerService.getCurrentInvestmentAmount.mockResolvedValue(
        500000,
      );

      arbitrageRecordService.createArbitrageCycle.mockResolvedValue({
        id: 'test-cycle-id-2',
        status: 'STARTED',
        initialInvestmentKrw: 500000,
        totalNetProfitPercent: 2.5,
      } as any);

      arbitrageRecordService.createTrade.mockResolvedValue({
        id: 'test-trade-id-2',
        cycleId: 'test-cycle-id-2',
        tradeType: 'LOW_PREMIUM_BUY',
        symbol: 'trx',
        status: 'PENDING',
      } as any);

      await service.initiateArbitrageCycle(reverseOpportunity);

      expect(arbitrageRecordService.createTrade).toHaveBeenCalledWith({
        cycleId: 'test-cycle-id-2',
        tradeType: 'LOW_PREMIUM_BUY',
        symbol: 'trx',
        status: 'COMPLETED',
        investmentKrw: 500000,
        netProfitKrw: 12500, // 500000 * 2.5 / 100
        details: {
          upbitPrice: 950,
          binancePrice: 1000,
          spreadPercent: 5.0,
          marketDirection: 'REVERSE',
          netProfitPercent: 2.5,
        },
      });
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[trx] 새로운 차익거래 사이클 시작: test-cycle-id-2, 초기 거래: test-trade-id-2',
      );
    });

    it('should stop execution when insufficient funds', async () => {
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

    it('should handle database errors gracefully', async () => {
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
  });
});
