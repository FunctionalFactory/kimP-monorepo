import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { KimPInitiatorModule } from '../../src/kim-p-initiator.module';
import { OpportunityScannerService } from '../../src/initiator/opportunity-scanner.service';
import { TradeExecutorService } from '../../src/initiator/trade-executor.service';
import { RedisSubscriberService } from '../../src/redis/redis-subscriber.service';

describe('KimPInitiator Integration Tests', () => {
  let module: TestingModule;
  let opportunityScannerService: OpportunityScannerService;
  let tradeExecutorService: TradeExecutorService;
  let redisSubscriberService: RedisSubscriberService;

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
        KimPInitiatorModule,
      ],
    }).compile();

    opportunityScannerService = module.get<OpportunityScannerService>(
      OpportunityScannerService,
    );
    tradeExecutorService =
      module.get<TradeExecutorService>(TradeExecutorService);
    redisSubscriberService = module.get<RedisSubscriberService>(
      RedisSubscriberService,
    );
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Service Integration', () => {
    it('should have all required services', () => {
      expect(opportunityScannerService).toBeDefined();
      expect(tradeExecutorService).toBeDefined();
      expect(redisSubscriberService).toBeDefined();
    });

    it('should have proper service types', () => {
      expect(typeof opportunityScannerService.onModuleInit).toBe('function');
      expect(typeof tradeExecutorService.initiateArbitrageCycle).toBe(
        'function',
      );
      expect(typeof redisSubscriberService.onModuleInit).toBe('function');
      expect(typeof redisSubscriberService.onModuleDestroy).toBe('function');
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
        upbit: 1000,
        binance: 950,
        spread: {
          normalOpportunity: true,
          reverseOpportunity: false,
        },
      };

      await expect(
        tradeExecutorService.initiateArbitrageCycle(opportunity),
      ).resolves.not.toThrow();
    });

    it('should handle different opportunity types', async () => {
      const normalOpportunity = {
        symbol: 'xrp',
        upbit: 1000,
        binance: 950,
        spread: {
          normalOpportunity: true,
          reverseOpportunity: false,
        },
      };

      const reverseOpportunity = {
        symbol: 'trx',
        upbit: 950,
        binance: 1000,
        spread: {
          normalOpportunity: false,
          reverseOpportunity: true,
        },
      };

      await expect(
        tradeExecutorService.initiateArbitrageCycle(normalOpportunity),
      ).resolves.not.toThrow();
      await expect(
        tradeExecutorService.initiateArbitrageCycle(reverseOpportunity),
      ).resolves.not.toThrow();
    });
  });

  describe('RedisSubscriberService Integration', () => {
    it('should initialize Redis connection', async () => {
      await expect(
        redisSubscriberService.onModuleInit(),
      ).resolves.not.toThrow();
    });

    it('should handle module destruction', async () => {
      await expect(
        redisSubscriberService.onModuleDestroy(),
      ).resolves.not.toThrow();
    });

    it('should have proper Redis configuration', () => {
      const privateService = redisSubscriberService as any;
      expect(privateService.CHANNEL).toBe('TICKER_UPDATES');
    });
  });

  describe('Module Integration', () => {
    it('should have proper dependency injection', () => {
      const privateScanner = opportunityScannerService as any;
      const privateSubscriber = redisSubscriberService as any;

      expect(privateScanner.tradeExecutor).toBeDefined();
      expect(privateScanner.eventEmitter).toBeDefined();
      expect(privateSubscriber.configService).toBeDefined();
      expect(privateSubscriber.eventEmitter).toBeDefined();
    });

    it('should have consistent service interfaces', () => {
      expect(opportunityScannerService.constructor.name).toBe(
        'OpportunityScannerService',
      );
      expect(tradeExecutorService.constructor.name).toBe(
        'TradeExecutorService',
      );
      expect(redisSubscriberService.constructor.name).toBe(
        'RedisSubscriberService',
      );
    });
  });
});
