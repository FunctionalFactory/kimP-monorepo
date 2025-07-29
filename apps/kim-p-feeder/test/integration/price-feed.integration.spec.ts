import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { KimPFeederModule } from '../../src/kim-p-feeder.module';
import { PriceFeedService } from '../../src/price-feed/price-feed.service';
import { RedisPublisherService } from '../../src/redis/redis-publisher.service';
import { testConfig } from '../test-config';

describe('PriceFeed Integration Tests', () => {
  let module: TestingModule;
  let priceFeedService: PriceFeedService;
  let redisPublisherService: RedisPublisherService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              WATCHED_SYMBOLS: testConfig.watchedSymbols,
              REDIS_HOST: testConfig.redis.host,
              REDIS_PORT: testConfig.redis.port,
              REDIS_PASSWORD: testConfig.redis.password,
              REDIS_DB: testConfig.redis.db,
            }),
          ],
        }),
        KimPFeederModule,
      ],
    }).compile();

    priceFeedService = module.get<PriceFeedService>(PriceFeedService);
    redisPublisherService = module.get<RedisPublisherService>(
      RedisPublisherService,
    );
  });

  afterAll(async () => {
    await module.close();
  });

  describe('PriceFeedService Integration', () => {
    it('should initialize with watched symbols', () => {
      const symbols = priceFeedService.getWatchedSymbols();
      expect(symbols).toHaveLength(2);
      expect(symbols[0].symbol).toBe('xrp');
      expect(symbols[1].symbol).toBe('trx');
    });

    it('should have correct symbol mappings', () => {
      const symbols = priceFeedService.getWatchedSymbols();
      const xrpSymbol = symbols.find((s) => s.symbol === 'xrp');
      const trxSymbol = symbols.find((s) => s.symbol === 'trx');

      expect(xrpSymbol).toBeDefined();
      expect(xrpSymbol?.upbit).toBe('KRW-XRP');
      expect(xrpSymbol?.binance).toBe('xrpusdt');

      expect(trxSymbol).toBeDefined();
      expect(trxSymbol?.upbit).toBe('KRW-TRX');
      expect(trxSymbol?.binance).toBe('trxusdt');
    });

    it('should return undefined for non-existent symbols', () => {
      expect(priceFeedService.getUpbitPrice('non-existent')).toBeUndefined();
      expect(priceFeedService.getBinancePrice('non-existent')).toBeUndefined();
      expect(priceFeedService.getUpbitVolume('non-existent')).toBeUndefined();
      expect(
        priceFeedService.getUpbitOrderBook('non-existent'),
      ).toBeUndefined();
    });

    it('should return empty maps initially', () => {
      const upbitPrices = priceFeedService.getAllUpbitPrices();
      const binancePrices = priceFeedService.getAllBinancePrices();

      expect(upbitPrices.size).toBe(0);
      expect(binancePrices.size).toBe(0);
    });
  });

  describe('RedisPublisherService Integration', () => {
    it('should have Redis status', () => {
      const status = redisPublisherService.getRedisStatus();
      expect(typeof status).toBe('string');
    });

    it('should handle ping when Redis is available', async () => {
      const pingResult = await redisPublisherService.ping();
      // Redis가 연결되어 있으면 PONG, 아니면 null
      expect(pingResult === 'PONG' || pingResult === null).toBe(true);
    });
  });

  describe('Module Integration', () => {
    it('should have all required services', () => {
      expect(priceFeedService).toBeDefined();
      expect(redisPublisherService).toBeDefined();
    });

    it('should have proper service types', () => {
      expect(typeof priceFeedService.getWatchedSymbols).toBe('function');
      expect(typeof priceFeedService.getUpbitPrice).toBe('function');
      expect(typeof priceFeedService.getBinancePrice).toBe('function');
      expect(typeof redisPublisherService.publishPriceUpdate).toBe('function');
      expect(typeof redisPublisherService.getRedisStatus).toBe('function');
    });
  });
});
