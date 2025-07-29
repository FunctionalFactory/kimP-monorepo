import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import {
  RedisSubscriberService,
  PriceUpdateData,
} from './redis-subscriber.service';

// Mock ioredis
const mockRedisClient = {
  on: jest.fn(),
  subscribe: jest.fn(),
  quit: jest.fn(),
};

jest.mock('ioredis', () => {
  const Redis = jest.fn().mockImplementation(() => mockRedisClient);
  return { default: Redis };
});

describe('RedisSubscriberService', () => {
  let service: RedisSubscriberService;
  let configService: jest.Mocked<ConfigService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  beforeEach(async () => {
    // mockRedisClient는 이미 전역으로 정의됨

    const mockConfigService = {
      get: jest
        .fn()
        .mockReturnValueOnce('localhost') // REDIS_HOST
        .mockReturnValueOnce(6379) // REDIS_PORT
        .mockReturnValueOnce('') // REDIS_PASSWORD
        .mockReturnValueOnce(0), // REDIS_DB
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisSubscriberService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<RedisSubscriberService>(RedisSubscriberService);
    configService = module.get(ConfigService);
    eventEmitter = module.get(EventEmitter2);

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

  describe('onModuleInit', () => {
    it('should connect to Redis and subscribe to channel', async () => {
      await service.onModuleInit();

      expect(Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0,
      });

      expect(mockRedisClient.subscribe).toHaveBeenCalledWith('TICKER_UPDATES');
      // connect 이벤트 핸들러가 호출되었는지 확인
      const connectHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )[1];
      connectHandler();

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '🟢 Connected to Redis for SUB at localhost:6379',
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Subscribed to Redis channel: TICKER_UPDATES',
      );
    });

    it('should handle Redis connection events', async () => {
      await service.onModuleInit();

      // Redis event handlers가 설정되었는지 확인
      expect(mockRedisClient.on).toHaveBeenCalledWith(
        'connect',
        expect.any(Function),
      );
      expect(mockRedisClient.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
      expect(mockRedisClient.on).toHaveBeenCalledWith(
        'close',
        expect.any(Function),
      );
      expect(mockRedisClient.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function),
      );
    });

    it('should handle Redis error events', async () => {
      await service.onModuleInit();

      // error 이벤트 핸들러 호출
      const errorHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'error',
      )[1];
      errorHandler(new Error('Redis connection failed'));

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Redis SUB error: Redis connection failed',
      );
    });

    it('should handle Redis close events', async () => {
      await service.onModuleInit();

      // close 이벤트 핸들러 호출
      const closeHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'close',
      )[1];
      closeHandler();

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Redis SUB connection closed',
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit Redis connection', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('should handle when Redis client is not initialized', async () => {
      await service.onModuleDestroy();

      expect(mockRedisClient.quit).not.toHaveBeenCalled();
    });
  });

  describe('message handling', () => {
    it('should emit price update events for valid messages', async () => {
      await service.onModuleInit();

      const priceData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 1000,
        timestamp: Date.now(),
      };

      // message 이벤트 핸들러 호출
      const messageHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'message',
      )[1];
      messageHandler('TICKER_UPDATES', JSON.stringify(priceData));

      expect(eventEmitter.emit).toHaveBeenCalledWith('price.update', priceData);
    });

    it('should ignore messages from other channels', async () => {
      await service.onModuleInit();

      const priceData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 1000,
        timestamp: Date.now(),
      };

      // message 이벤트 핸들러 호출 (다른 채널)
      const messageHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'message',
      )[1];
      messageHandler('OTHER_CHANNEL', JSON.stringify(priceData));

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON messages', async () => {
      await service.onModuleInit();

      // message 이벤트 핸들러 호출 (잘못된 JSON)
      const messageHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'message',
      )[1];
      messageHandler('TICKER_UPDATES', 'invalid json');

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse price update: SyntaxError'),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should handle malformed price data', async () => {
      await service.onModuleInit();

      const malformedData = {
        symbol: 'xrp',
        // price와 timestamp가 누락됨
      };

      // message 이벤트 핸들러 호출
      const messageHandler = mockRedisClient.on.mock.calls.find(
        (call) => call[0] === 'message',
      )[1];
      messageHandler('TICKER_UPDATES', JSON.stringify(malformedData));

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'price.update',
        malformedData,
      );
    });
  });

  describe('configuration', () => {
    it('should use default values when config is not provided', async () => {
      configService.get.mockReturnValue(undefined);

      await service.onModuleInit();

      expect(Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0,
      });
    });

    it('should use custom configuration values', async () => {
      // 새로운 서비스 인스턴스 생성
      const customConfigService = {
        get: jest
          .fn()
          .mockReturnValueOnce('redis.example.com') // REDIS_HOST
          .mockReturnValueOnce(6380) // REDIS_PORT
          .mockReturnValueOnce('password123') // REDIS_PASSWORD
          .mockReturnValueOnce(1), // REDIS_DB
      };

      const customModule = await Test.createTestingModule({
        providers: [
          RedisSubscriberService,
          {
            provide: ConfigService,
            useValue: customConfigService,
          },
          {
            provide: EventEmitter2,
            useValue: { emit: jest.fn() },
          },
        ],
      }).compile();

      const customService = customModule.get<RedisSubscriberService>(
        RedisSubscriberService,
      );
      await customService.onModuleInit();

      expect(Redis).toHaveBeenCalledWith({
        host: 'redis.example.com',
        port: 6380,
        password: 'password123',
        db: 1,
      });
    });
  });
});
