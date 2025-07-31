import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OpportunityScannerService } from '../../src/initiator/opportunity-scanner.service';
import { TradeExecutorService } from '../../src/initiator/trade-executor.service';
import {
  SpreadCalculatorService,
  LoggingService,
  ArbitrageRecordService,
  PortfolioManagerService,
  ErrorHandlerService,
  DistributedLockService,
  InvestmentConfigService,
  ExchangeService,
  StrategyHighService,
  StrategyLowService,
} from '@app/kimp-core';

describe('KimPInitiator Integration Tests', () => {
  let module: TestingModule;
  let opportunityScannerService: OpportunityScannerService;
  let tradeExecutorService: TradeExecutorService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              REDIS_HOST: 'localhost',
              REDIS_PORT: 6379,
              REDIS_PASSWORD: '',
              REDIS_DB: 0,
            }),
          ],
        }),
      ],
      providers: [
        OpportunityScannerService,
        TradeExecutorService,
        {
          provide: SpreadCalculatorService,
          useValue: {
            calculateSpread: jest.fn().mockResolvedValue({
              symbol: 'xrp',
              upbitPrice: 1000,
              binancePrice: 950,
              spreadPercent: 5.26,
              isNormalOpportunity: true,
              netProfitPercent: 3.5,
              totalFee: 5000,
              slippageImpact: 0.1,
              volumeCheck: true,
            }),
          },
        },
        {
          provide: LoggingService,
          useValue: {
            error: jest.fn(),
            info: jest.fn(),
          },
        },
        {
          provide: ArbitrageRecordService,
          useValue: {
            createArbitrageCycle: jest.fn().mockResolvedValue({
              id: 'test-cycle-id',
              status: 'STARTED',
            }),
            createTrade: jest.fn().mockResolvedValue({
              id: 'test-trade-id',
              cycleId: 'test-cycle-id',
              status: 'PENDING',
            }),
          },
        },
        {
          provide: PortfolioManagerService,
          useValue: {
            getCurrentInvestmentAmount: jest.fn().mockResolvedValue(1000000),
          },
        },
        {
          provide: ErrorHandlerService,
          useValue: {
            handleError: jest.fn(),
          },
        },
        {
          provide: DistributedLockService,
          useValue: {
            acquireLock: jest.fn().mockResolvedValue(true),
            releaseLock: jest.fn(),
          },
        },
        {
          provide: InvestmentConfigService,
          useValue: {
            getInvestmentConfig: jest.fn().mockReturnValue({
              minSpreadPercent: 0.5,
              exchangeRateUsdtKrw: 1300,
            }),
          },
        },
        {
          provide: PortfolioManagerService,
          useValue: {
            getCurrentInvestmentAmount: jest.fn().mockResolvedValue(1000000),
          },
        },
        {
          provide: ExchangeService,
          useValue: {
            // 필요한 메서드들 추가
          },
        },
        {
          provide: StrategyHighService,
          useValue: {
            handleHighPremiumFlow: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: StrategyLowService,
          useValue: {
            handleLowPremiumFlow: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: 'ConfigService',
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue: any) => {
                const config = {
                  REDIS_HOST: 'localhost',
                  REDIS_PORT: 6379,
                  REDIS_PASSWORD: '',
                  REDIS_DB: 0,
                };
                return config[key] || defaultValue;
              }),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    opportunityScannerService = module.get<OpportunityScannerService>(
      OpportunityScannerService,
    );
    tradeExecutorService =
      module.get<TradeExecutorService>(TradeExecutorService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Service Integration', () => {
    it('should have all required services', () => {
      expect(opportunityScannerService).toBeDefined();
      expect(tradeExecutorService).toBeDefined();
    });

    it('should have proper service types', () => {
      expect(typeof opportunityScannerService.onModuleInit).toBe('function');
      expect(typeof tradeExecutorService.initiateArbitrageCycle).toBe(
        'function',
      );
    });
  });

  describe('OpportunityScannerService Integration', () => {
    it('should initialize correctly', () => {
      expect(() => opportunityScannerService.onModuleInit()).not.toThrow();
    });

    it('should have event handling capabilities', () => {
      const privateService = opportunityScannerService as any;
      expect(privateService.tradeExecutor).toBeDefined();
      expect(privateService.eventEmitter).toBeDefined();
    });
  });

  describe('TradeExecutorService Integration', () => {
    it('should handle arbitrage cycle initiation', async () => {
      const opportunity = {
        symbol: 'xrp',
        upbitPrice: 1000,
        binancePrice: 950,
        spreadPercent: 5.0,
        isNormalOpportunity: true,
        netProfitPercent: 3.5,
      };

      await expect(
        tradeExecutorService.initiateArbitrageCycle(opportunity),
      ).resolves.not.toThrow();
    });

    it('should handle different opportunity types', async () => {
      const normalOpportunity = {
        symbol: 'xrp',
        upbitPrice: 1000,
        binancePrice: 950,
        spreadPercent: 5.0,
        isNormalOpportunity: true,
        netProfitPercent: 3.5,
      };

      const reverseOpportunity = {
        symbol: 'trx',
        upbitPrice: 950,
        binancePrice: 1000,
        spreadPercent: 5.0,
        isNormalOpportunity: false,
        netProfitPercent: 2.5,
      };

      await expect(
        tradeExecutorService.initiateArbitrageCycle(normalOpportunity),
      ).resolves.not.toThrow();
      await expect(
        tradeExecutorService.initiateArbitrageCycle(reverseOpportunity),
      ).resolves.not.toThrow();
    });
  });

  describe('Module Integration', () => {
    it('should have proper dependency injection', () => {
      const privateScanner = opportunityScannerService as any;
      expect(privateScanner.tradeExecutor).toBeDefined();
      expect(privateScanner.eventEmitter).toBeDefined();
    });

    it('should have consistent service interfaces', () => {
      expect(opportunityScannerService.constructor.name).toBe(
        'OpportunityScannerService',
      );
      expect(tradeExecutorService.constructor.name).toBe(
        'TradeExecutorService',
      );
    });
  });
});
