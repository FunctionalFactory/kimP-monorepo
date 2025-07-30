import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OpportunityScannerService } from './opportunity-scanner.service';
import { TradeExecutorService } from './trade-executor.service';
import { PriceUpdateData } from '../redis/redis-subscriber.service';
import {
  FeeCalculatorService,
  LoggingService,
  InvestmentConfigService,
  PortfolioManagerService,
  ExchangeService,
} from '@app/kimp-core';

describe('OpportunityScannerService', () => {
  let service: OpportunityScannerService;
  let tradeExecutor: jest.Mocked<TradeExecutorService>;
  let feeCalculatorService: jest.Mocked<FeeCalculatorService>;
  let loggingService: jest.Mocked<LoggingService>;
  let investmentConfigService: jest.Mocked<InvestmentConfigService>;
  let portfolioManagerService: jest.Mocked<PortfolioManagerService>;
  let exchangeService: jest.Mocked<ExchangeService>;

  beforeEach(async () => {
    const mockTradeExecutor = {
      initiateArbitrageCycle: jest.fn(),
    };

    const mockFeeCalculatorService = {
      calculate: jest.fn(),
    };

    const mockLoggingService = {
      error: jest.fn(),
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

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpportunityScannerService,
        {
          provide: TradeExecutorService,
          useValue: mockTradeExecutor,
        },
        {
          provide: FeeCalculatorService,
          useValue: mockFeeCalculatorService,
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
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<OpportunityScannerService>(OpportunityScannerService);
    tradeExecutor = module.get(TradeExecutorService);
    feeCalculatorService = module.get(FeeCalculatorService);
    loggingService = module.get(LoggingService);
    investmentConfigService = module.get(InvestmentConfigService);
    portfolioManagerService = module.get(PortfolioManagerService);
    exchangeService = module.get(ExchangeService);

    // Logger를 mock으로 설정
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should log initialization message', () => {
      service.onModuleInit();

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'OpportunityScannerService initialized. Listening for price updates...',
      );
    });
  });

  describe('handlePriceUpdate', () => {
    it('should store price updates', async () => {
      const upbitData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 1000,
        timestamp: Date.now(),
      };

      await service.handlePriceUpdate(upbitData);

      // Private property에 접근하여 확인
      const privateService = service as any;
      expect(privateService.lastPrices['xrp'].upbit).toBe(1000);
    });

    it('should detect profitable opportunity when spread > 0.5%', async () => {
      const upbitData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 1000,
        timestamp: Date.now(),
      };

      const binanceData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'binance',
        price: 994, // 0.6% 스프레드
        timestamp: Date.now(),
      };

      // FeeCalculatorService mock 설정
      feeCalculatorService.calculate.mockReturnValue({
        grossProfit: 6000,
        totalFee: 1000,
        netProfit: 5000,
        netProfitPercent: 0.3,
        binanceSpotBuyFeeKrw: 500,
        upbitSellFeeKrw: 500,
        transferCoinToUpbitFeeKrw: 0,
        usdtTransferFeeKrw: 0,
        binanceFuturesEntryFeeKrw: 0,
        binanceFuturesExitFeeKrw: 0,
      });

      await service.handlePriceUpdate(upbitData);
      await service.handlePriceUpdate(binanceData);

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[기회감지] xrp 스프레드: 0.60%, Normal: true',
      );
      expect(tradeExecutor.initiateArbitrageCycle).toHaveBeenCalledWith({
        symbol: 'xrp',
        upbitPrice: 1000,
        binancePrice: 994,
        spreadPercent: 0.6,
        isNormalOpportunity: true,
        netProfitPercent: 0.3,
      });
    });

    it('should not detect opportunity when spread < 0.5%', async () => {
      const upbitData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 1000,
        timestamp: Date.now(),
      };

      const binanceData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'binance',
        price: 998, // 0.2% 스프레드
        timestamp: Date.now(),
      };

      await service.handlePriceUpdate(upbitData);
      await service.handlePriceUpdate(binanceData);

      expect(tradeExecutor.initiateArbitrageCycle).not.toHaveBeenCalled();
    });

    it('should detect reverse opportunity when binance price > upbit price', async () => {
      const upbitData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 994,
        timestamp: Date.now(),
      };

      const binanceData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'binance',
        price: 1000, // 0.6% 스프레드 (reverse)
        timestamp: Date.now(),
      };

      // FeeCalculatorService mock 설정
      feeCalculatorService.calculate.mockReturnValue({
        grossProfit: 4000,
        totalFee: 1000,
        netProfit: 3000,
        netProfitPercent: 0.2,
        binanceSpotBuyFeeKrw: 500,
        upbitSellFeeKrw: 500,
        transferCoinToUpbitFeeKrw: 0,
        usdtTransferFeeKrw: 0,
        binanceFuturesEntryFeeKrw: 0,
        binanceFuturesExitFeeKrw: 0,
      });

      await service.handlePriceUpdate(upbitData);
      await service.handlePriceUpdate(binanceData);

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[기회감지] xrp 스프레드: 0.60%, Normal: false',
      );
      expect(tradeExecutor.initiateArbitrageCycle).toHaveBeenCalledWith({
        symbol: 'xrp',
        upbitPrice: 994,
        binancePrice: 1000,
        spreadPercent: expect.closeTo(0.6, 2),
        isNormalOpportunity: false,
        netProfitPercent: 0.2,
      });
    });

    it('should handle fee calculation errors gracefully', async () => {
      const upbitData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 1000,
        timestamp: Date.now(),
      };

      const binanceData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'binance',
        price: 994,
        timestamp: Date.now(),
      };

      // FeeCalculatorService에서 에러 발생
      feeCalculatorService.calculate.mockImplementation(() => {
        throw new Error('Fee calculation failed');
      });

      await service.handlePriceUpdate(upbitData);
      await service.handlePriceUpdate(binanceData);

      expect(loggingService.error).toHaveBeenCalledWith(
        '스프레드 계산 중 오류: Fee calculation failed',
        expect.any(Error),
        { service: 'OpportunityScannerService' },
      );
      expect(tradeExecutor.initiateArbitrageCycle).not.toHaveBeenCalled();
    });
  });
});
