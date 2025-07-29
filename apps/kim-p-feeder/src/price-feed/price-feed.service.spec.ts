import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PriceFeedService, WatchedSymbolConfig } from './price-feed.service';
import { ExchangeService } from '@app/kimp-core';
import { RedisPublisherService } from '../redis/redis-publisher.service';

// Mock WebSocket
jest.mock('ws', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    send: jest.fn(),
    removeAllListeners: jest.fn(),
    terminate: jest.fn(),
  }));
});

describe('PriceFeedService', () => {
  let service: PriceFeedService;
  let configService: jest.Mocked<ConfigService>;

  const mockWatchedSymbols: WatchedSymbolConfig[] = [
    { symbol: 'xrp', upbit: 'KRW-XRP', binance: 'xrpusdt' },
    { symbol: 'trx', upbit: 'KRW-TRX', binance: 'trxusdt' },
  ];

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue(mockWatchedSymbols),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceFeedService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ExchangeService,
          useValue: {
            getOrderBook: jest.fn(),
            getTickerInfo: jest.fn(),
          },
        },
        {
          provide: RedisPublisherService,
          useValue: {
            publishPriceUpdate: jest.fn(),
            publishBatchPriceUpdates: jest.fn(),
            getRedisStatus: jest.fn(),
            ping: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PriceFeedService>(PriceFeedService);
    configService = module.get(ConfigService);

    // Logger를 mock으로 설정
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getWatchedSymbols', () => {
    it('should return watched symbols configuration', () => {
      const result = service.getWatchedSymbols();
      expect(result).toEqual(mockWatchedSymbols);
      expect(result).toHaveLength(2);
    });

    it('should return readonly array', () => {
      const result = service.getWatchedSymbols();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getUpbitPrice', () => {
    it('should return undefined when price not set', () => {
      const result = service.getUpbitPrice('xrp');
      expect(result).toBeUndefined();
    });

    it('should return price when set', () => {
      // Private method를 테스트하기 위해 reflection 사용
      const privateService = service as any;
      privateService.upbitPrices.set('xrp', 1000);

      const result = service.getUpbitPrice('xrp');
      expect(result).toBe(1000);
    });
  });

  describe('getBinancePrice', () => {
    it('should return undefined when price not set', () => {
      const result = service.getBinancePrice('xrp');
      expect(result).toBeUndefined();
    });

    it('should return price when set', () => {
      const privateService = service as any;
      privateService.binancePrices.set('xrp', 950);

      const result = service.getBinancePrice('xrp');
      expect(result).toBe(950);
    });
  });

  describe('getAllUpbitPrices', () => {
    it('should return readonly map of all upbit prices', () => {
      const privateService = service as any;
      privateService.upbitPrices.set('xrp', 1000);
      privateService.upbitPrices.set('trx', 2000);

      const result = service.getAllUpbitPrices();
      expect(result.get('xrp')).toBe(1000);
      expect(result.get('trx')).toBe(2000);
      expect(result.size).toBe(2);
    });
  });

  describe('getAllBinancePrices', () => {
    it('should return readonly map of all binance prices', () => {
      const privateService = service as any;
      privateService.binancePrices.set('xrp', 950);
      privateService.binancePrices.set('trx', 1950);

      const result = service.getAllBinancePrices();
      expect(result.get('xrp')).toBe(950);
      expect(result.get('trx')).toBe(1950);
      expect(result.size).toBe(2);
    });
  });

  describe('getUpbitVolume', () => {
    it('should return undefined when volume not set', () => {
      const result = service.getUpbitVolume('xrp');
      expect(result).toBeUndefined();
    });

    it('should return volume when set', () => {
      const privateService = service as any;
      privateService.upbitVolumes.set('xrp', 1000000);

      const result = service.getUpbitVolume('xrp');
      expect(result).toBe(1000000);
    });
  });

  describe('getUpbitOrderBook', () => {
    it('should return undefined when orderbook not set', () => {
      const result = service.getUpbitOrderBook('xrp');
      expect(result).toBeUndefined();
    });

    it('should return orderbook when set', () => {
      const mockOrderBook = { bids: [[1000, 1]], asks: [[1001, 1]] };
      const privateService = service as any;
      privateService.upbitOrderBooks.set('xrp', mockOrderBook);

      const result = service.getUpbitOrderBook('xrp');
      expect(result).toEqual(mockOrderBook);
    });
  });

  describe('initialization', () => {
    it('should initialize with correct number of required connections', () => {
      const privateService = service as any;
      expect(privateService.totalRequiredConnections).toBe(4); // 2 symbols * 2 exchanges
    });

    it('should load watched symbols from config', () => {
      expect(configService.get).toHaveBeenCalledWith('WATCHED_SYMBOLS');
    });
  });

  describe('module lifecycle', () => {
    it('should handle module initialization', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const privateService = service as any;

      // Mock private methods
      jest
        .spyOn(privateService, 'connectToAllFeeds')
        .mockImplementation(() => {});
      jest
        .spyOn(privateService, 'initializeOrderBooks')
        .mockImplementation(() => {});

      service.onModuleInit();

      expect(logSpy).toHaveBeenCalledWith(
        'PriceFeedService Initialized. Starting to connect to WebSockets...',
      );
    });

    it('should handle module destruction', () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const privateService = service as any;

      // Mock private methods
      jest
        .spyOn(privateService, 'closeAllSockets')
        .mockImplementation(() => {});

      service.onModuleDestroy();

      expect(logSpy).toHaveBeenCalledWith(
        'PriceFeedService Destroyed. Closing all WebSocket connections...',
      );
    });
  });
});
