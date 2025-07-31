import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { RedisPublisherService } from './redis-publisher.service';
import { PriceUpdateData } from '../price-feed/price-feed.service';

// Mock ioredis
const mockRedisClient = {
  on: jest.fn(),
  connect: jest.fn(),
  quit: jest.fn(),
  publish: jest.fn(),
  pipeline: jest.fn(),
  ping: jest.fn(),
  status: 'ready',
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedisClient);
});

describe('RedisPublisherService', () => {
  let service: RedisPublisherService;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisPublisherService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RedisPublisherService>(RedisPublisherService);

    // Logger를 mock으로 설정
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => {});

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRedisStatus', () => {
    it('should return connected when Redis is ready', () => {
      const privateService = service as any;
      privateService.redisClient = mockRedisClient;
      mockRedisClient.status = 'ready';

      const status = service.getRedisStatus();
      expect(status).toBe('connected');
    });

    it('should return disconnected when Redis client is not available', () => {
      const privateService = service as any;
      privateService.redisClient = null;

      const status = service.getRedisStatus();
      expect(status).toBe('disconnected');
    });
  });

  describe('ping', () => {
    it('should return pong when Redis is ready', async () => {
      const privateService = service as any;
      privateService.redisClient = mockRedisClient;
      mockRedisClient.status = 'ready';
      mockRedisClient.ping.mockResolvedValue('PONG');

      const result = await service.ping();

      expect(result).toBe('PONG');
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    it('should return null when Redis is not ready', async () => {
      const privateService = service as any;
      privateService.redisClient = mockRedisClient;
      mockRedisClient.status = 'end';

      const result = await service.ping();

      expect(result).toBeNull();
      expect(mockRedisClient.ping).not.toHaveBeenCalled();
    });

    it('should handle ping error gracefully', async () => {
      const privateService = service as any;
      privateService.redisClient = mockRedisClient;
      mockRedisClient.status = 'ready';
      mockRedisClient.ping.mockRejectedValue(new Error('Ping failed'));

      const result = await service.ping();

      expect(result).toBeNull();
    });
  });

  describe('publishPriceUpdate', () => {
    const mockPriceData: PriceUpdateData = {
      symbol: 'xrp',
      exchange: 'upbit',
      price: 1000,
      timestamp: Date.now(),
    };

    it('should publish price update when Redis is ready', async () => {
      const privateService = service as any;
      privateService.redisClient = mockRedisClient;
      mockRedisClient.status = 'ready';
      mockRedisClient.publish.mockResolvedValue(1);

      await service.publishPriceUpdate(mockPriceData);

      expect(mockRedisClient.publish).toHaveBeenCalledWith(
        'TICKER_UPDATES',
        expect.stringContaining('"symbol":"xrp"'),
      );
    });

    it('should not publish when Redis is not ready', async () => {
      const privateService = service as any;
      privateService.redisClient = mockRedisClient;
      mockRedisClient.status = 'end';

      await service.publishPriceUpdate(mockPriceData);

      expect(mockRedisClient.publish).not.toHaveBeenCalled();
    });

    it('should handle publish error gracefully', async () => {
      const privateService = service as any;
      privateService.redisClient = mockRedisClient;
      mockRedisClient.status = 'ready';
      mockRedisClient.publish.mockRejectedValue(new Error('Publish failed'));

      await service.publishPriceUpdate(mockPriceData);

      expect(mockRedisClient.publish).toHaveBeenCalled();
    });
  });

  describe('publishBatchPriceUpdates', () => {
    const mockPriceDataArray: PriceUpdateData[] = [
      {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 1000,
        timestamp: Date.now(),
      },
      {
        symbol: 'trx',
        exchange: 'binance',
        price: 950,
        timestamp: Date.now(),
      },
    ];

    it('should publish batch updates when Redis is ready', async () => {
      const privateService = service as any;
      privateService.redisClient = mockRedisClient;
      mockRedisClient.status = 'ready';
      const mockPipeline = {
        publish: jest.fn(),
        exec: jest.fn().mockResolvedValue([]),
      };
      mockRedisClient.pipeline.mockReturnValue(mockPipeline as any);

      await service.publishBatchPriceUpdates(mockPriceDataArray);

      expect(mockRedisClient.pipeline).toHaveBeenCalled();
      expect(mockPipeline.publish).toHaveBeenCalledTimes(2);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should not publish batch when Redis is not ready', async () => {
      const privateService = service as any;
      privateService.redisClient = mockRedisClient;
      mockRedisClient.status = 'end';

      await service.publishBatchPriceUpdates(mockPriceDataArray);

      expect(mockRedisClient.pipeline).not.toHaveBeenCalled();
    });
  });
});
