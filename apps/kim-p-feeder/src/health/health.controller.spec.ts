import { Test, TestingModule } from '@nestjs/testing';
import { PriceFeedService } from '../price-feed/price-feed.service';
import { RedisPublisherService } from '../redis/redis-publisher.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let priceFeedService: jest.Mocked<PriceFeedService>;
  let redisPublisherService: jest.Mocked<RedisPublisherService>;

  beforeEach(async () => {
    const mockPriceFeedService = {
      getConnectionStatus: jest.fn(),
      getWatchedSymbols: jest.fn(),
    };

    const mockRedisPublisherService = {
      getRedisStatus: jest.fn(),
      publishPriceUpdate: jest.fn(),
      publishBatchPriceUpdates: jest.fn(),
      ping: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PriceFeedService,
          useValue: mockPriceFeedService,
        },
        {
          provide: RedisPublisherService,
          useValue: mockRedisPublisherService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    priceFeedService = module.get(PriceFeedService);
    redisPublisherService = module.get(RedisPublisherService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return ok status when all dependencies are connected', async () => {
      // Mock WebSocket connected status
      priceFeedService.getConnectionStatus.mockReturnValue('connected');

      // Mock Redis connected status
      redisPublisherService.getRedisStatus.mockReturnValue('connected');

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'ok',
        dependencies: {
          webSockets: 'connected',
          redis: 'connected',
        },
        uptime: expect.any(Number),
      });
    });

    it('should return error status when WebSockets are disconnected', async () => {
      // Mock WebSocket disconnected status
      priceFeedService.getConnectionStatus.mockReturnValue('disconnected');

      // Mock Redis connected status
      redisPublisherService.getRedisStatus.mockReturnValue('connected');

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'error',
        dependencies: {
          webSockets: 'disconnected',
          redis: 'connected',
        },
        uptime: expect.any(Number),
      });
    });

    it('should return error status when Redis is disconnected', async () => {
      // Mock WebSocket connected status
      priceFeedService.getConnectionStatus.mockReturnValue('connected');

      // Mock Redis disconnected status
      redisPublisherService.getRedisStatus.mockReturnValue('disconnected');

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'error',
        dependencies: {
          webSockets: 'connected',
          redis: 'disconnected',
        },
        uptime: expect.any(Number),
      });
    });

    it('should return error status when both dependencies are disconnected', async () => {
      // Mock WebSocket disconnected status
      priceFeedService.getConnectionStatus.mockReturnValue('disconnected');

      // Mock Redis disconnected status
      redisPublisherService.getRedisStatus.mockReturnValue('disconnected');

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'error',
        dependencies: {
          webSockets: 'disconnected',
          redis: 'disconnected',
        },
        uptime: expect.any(Number),
      });
    });

    it('should handle exceptions gracefully', async () => {
      // Mock service methods to throw errors
      priceFeedService.getConnectionStatus.mockImplementation(() => {
        throw new Error('Service unavailable');
      });
      redisPublisherService.getRedisStatus.mockImplementation(() => {
        throw new Error('Redis unavailable');
      });

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'error',
        dependencies: {
          webSockets: 'disconnected',
          redis: 'disconnected',
        },
        uptime: expect.any(Number),
      });
    });

    it('should include uptime in response', async () => {
      // Mock both services as connected
      priceFeedService.getConnectionStatus.mockReturnValue('connected');
      redisPublisherService.getRedisStatus.mockReturnValue('connected');

      const result = await controller.getHealth();

      expect(result.uptime).toBeDefined();
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThan(0);
    });
  });
});
