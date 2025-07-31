import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OpportunityScannerService } from './opportunity-scanner.service';
import { TradeExecutorService } from './trade-executor.service';
import { PriceUpdateData } from '../redis/redis-subscriber.service';
import {
  SpreadCalculatorService,
  LoggingService,
  InvestmentConfigService,
  PortfolioManagerService,
  ExchangeService,
} from '@app/kimp-core';

describe('OpportunityScannerService', () => {
  let service: OpportunityScannerService;
  let tradeExecutor: jest.Mocked<TradeExecutorService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let spreadCalculatorService: jest.Mocked<SpreadCalculatorService>;
  let loggingService: jest.Mocked<LoggingService>;
  let investmentConfigService: jest.Mocked<InvestmentConfigService>;
  let portfolioManagerService: jest.Mocked<PortfolioManagerService>;
  let exchangeService: jest.Mocked<ExchangeService>;

  beforeEach(async () => {
    const mockTradeExecutor = {
      initiateArbitrageCycle: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const mockSpreadCalculatorService = {
      calculateSpread: jest.fn(),
    };

    const mockLoggingService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockInvestmentConfigService = {
      getInvestmentConfig: jest.fn().mockReturnValue({
        minSpreadPercent: 0.5,
        exchangeRateUsdtKrw: 1300,
      }),
    };

    const mockPortfolioManagerService = {
      getCurrentInvestmentAmount: jest.fn().mockResolvedValue(1000000),
    };

    const mockExchangeService = {
      // 필요한 메서드들 추가
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpportunityScannerService,
        {
          provide: TradeExecutorService,
          useValue: mockTradeExecutor,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: SpreadCalculatorService,
          useValue: mockSpreadCalculatorService,
        },
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
        {
          provide: InvestmentConfigService,
          useValue: mockInvestmentConfigService,
        },
        {
          provide: PortfolioManagerService,
          useValue: mockPortfolioManagerService,
        },
        {
          provide: ExchangeService,
          useValue: mockExchangeService,
        },
      ],
    }).compile();

    service = module.get<OpportunityScannerService>(OpportunityScannerService);
    tradeExecutor = module.get(TradeExecutorService);
    eventEmitter = module.get(EventEmitter2);
    spreadCalculatorService = module.get(SpreadCalculatorService);
    loggingService = module.get(LoggingService);
    investmentConfigService = module.get(InvestmentConfigService);
    portfolioManagerService = module.get(PortfolioManagerService);
    exchangeService = module.get(ExchangeService);

    // Logger를 mock으로 설정
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'debug').mockImplementation(() => {});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handlePriceUpdate', () => {
    it('should detect opportunity when both prices are available', async () => {
      const upbitData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 1000,
        timestamp: Date.now(),
      };

      const binanceData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'binance',
        price: 950,
        timestamp: Date.now(),
      };

      const mockSpreadResult = {
        symbol: 'xrp',
        upbitPrice: 1000,
        binancePrice: 950,
        spreadPercent: 5.26,
        isNormalOpportunity: true,
        netProfitPercent: 3.5,
        totalFee: 5000,
        slippageImpact: 0.5,
        volumeCheck: true,
      };

      spreadCalculatorService.calculateSpread.mockResolvedValue(
        mockSpreadResult,
      );

      // 첫 번째 가격 업데이트
      await service.handlePriceUpdate(upbitData);
      expect(tradeExecutor.initiateArbitrageCycle).not.toHaveBeenCalled();

      // 두 번째 가격 업데이트
      await service.handlePriceUpdate(binanceData);

      expect(spreadCalculatorService.calculateSpread).toHaveBeenCalledWith({
        symbol: 'xrp',
        upbitPrice: 1000,
        binancePrice: 950,
        investmentAmount: 1000000,
      });

      expect(tradeExecutor.initiateArbitrageCycle).toHaveBeenCalledWith({
        symbol: 'xrp',
        upbitPrice: 1000,
        binancePrice: 950,
        spreadPercent: 5.26,
        isNormalOpportunity: true,
        netProfitPercent: 3.5,
      });
    });

    it('should not detect opportunity when spread calculation returns null', async () => {
      const upbitData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 1000,
        timestamp: Date.now(),
      };

      const binanceData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'binance',
        price: 999,
        timestamp: Date.now(),
      };

      spreadCalculatorService.calculateSpread.mockResolvedValue(null);

      await service.handlePriceUpdate(upbitData);
      await service.handlePriceUpdate(binanceData);

      expect(spreadCalculatorService.calculateSpread).toHaveBeenCalled();
      expect(tradeExecutor.initiateArbitrageCycle).not.toHaveBeenCalled();
    });

    it('should handle spread calculation errors gracefully', async () => {
      const upbitData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 1000,
        timestamp: Date.now(),
      };

      const binanceData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'binance',
        price: 950,
        timestamp: Date.now(),
      };

      spreadCalculatorService.calculateSpread.mockRejectedValue(
        new Error('Calculation failed'),
      );

      await service.handlePriceUpdate(upbitData);
      await service.handlePriceUpdate(binanceData);

      expect(loggingService.error).toHaveBeenCalledWith(
        '스프레드 계산 중 오류: Calculation failed',
        expect.any(Error),
        { service: 'OpportunityScannerService' },
      );
      expect(tradeExecutor.initiateArbitrageCycle).not.toHaveBeenCalled();
    });

    it('should not process when investment amount is zero', async () => {
      const upbitData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 1000,
        timestamp: Date.now(),
      };

      const binanceData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'binance',
        price: 950,
        timestamp: Date.now(),
      };

      portfolioManagerService.getCurrentInvestmentAmount.mockResolvedValue(0);

      await service.handlePriceUpdate(upbitData);
      await service.handlePriceUpdate(binanceData);

      expect(spreadCalculatorService.calculateSpread).not.toHaveBeenCalled();
      expect(tradeExecutor.initiateArbitrageCycle).not.toHaveBeenCalled();
    });
  });
});
