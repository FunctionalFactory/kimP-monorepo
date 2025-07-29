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
      const privateService = priceFeedService as any;
      privateService.connectedSockets = new Set(['socket1', 'socket2']);
      privateService.totalRequiredConnections = 2;

      // Mock Redis connected status
      redisPublisherService.getRedisStatus.mockReturnValue('ready');

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'ok',
        dependencies: {
          webSockets: 'connected',
          redis: 'connected',
        },
      });
    });

    it('should return error status when WebSockets are disconnected', async () => {
      // Mock WebSocket disconnected status
      const privateService = priceFeedService as any;
      privateService.connectedSockets = new Set(['socket1']); // Only 1 connected, need 2
      privateService.totalRequiredConnections = 2;

      // Mock Redis connected status
      redisPublisherService.getRedisStatus.mockReturnValue('ready');

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'error',
        dependencies: {
          webSockets: 'disconnected',
          redis: 'connected',
        },
      });
    });

    it('should return error status when Redis is disconnected', async () => {
      // Mock WebSocket connected status
      const privateService = priceFeedService as any;
      privateService.connectedSockets = new Set(['socket1', 'socket2']);
      privateService.totalRequiredConnections = 2;

      // Mock Redis disconnected status
      redisPublisherService.getRedisStatus.mockReturnValue('end');

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'error',
        dependencies: {
          webSockets: 'connected',
          redis: 'disconnected',
        },
      });
    });

    it('should return error status when both dependencies are disconnected', async () => {
      // Mock WebSocket disconnected status
      const privateService = priceFeedService as any;
      privateService.connectedSockets = new Set(['socket1']); // Only 1 connected, need 2
      privateService.totalRequiredConnections = 2;

      // Mock Redis disconnected status
      redisPublisherService.getRedisStatus.mockReturnValue('end');

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'error',
        dependencies: {
          webSockets: 'disconnected',
          redis: 'disconnected',
        },
      });
    });

    it('should handle WebSocket status check errors gracefully', async () => {
      // Mock WebSocket status check to throw error
      const privateService = priceFeedService as any;
      privateService.connectedSockets = undefined; // This will cause an error

      // Mock Redis connected status
      redisPublisherService.getRedisStatus.mockReturnValue('ready');

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'error',
        dependencies: {
          webSockets: 'disconnected',
          redis: 'connected',
        },
      });
    });

    it('should handle Redis status check errors gracefully', async () => {
      // Mock WebSocket connected status
      const privateService = priceFeedService as any;
      privateService.connectedSockets = new Set(['socket1', 'socket2']);
      privateService.totalRequiredConnections = 2;

      // Mock Redis status check to throw error
      redisPublisherService.getRedisStatus.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      const result = await controller.getHealth();

      expect(result).toEqual({
        status: 'error',
        dependencies: {
          webSockets: 'connected',
          redis: 'disconnected',
        },
      });
    });
  });
});
