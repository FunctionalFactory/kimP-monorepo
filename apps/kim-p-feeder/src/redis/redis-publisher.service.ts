// apps/kim-p-feeder/src/redis/redis-publisher.service.ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PriceUpdateData } from '../price-feed/price-feed.service';

@Injectable()
export class RedisPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPublisherService.name);
  private redisClient: Redis;
  private readonly REDIS_CHANNEL = 'TICKER_UPDATES';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connectToRedis();
  }

  async onModuleDestroy() {
    await this.disconnectFromRedis();
  }

  private async connectToRedis() {
    try {
      const redisHost = this.configService.get<string>(
        'REDIS_HOST',
        'localhost',
      );
      const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
      const redisPassword = this.configService.get<string>(
        'REDIS_PASSWORD',
        '',
      );
      const redisDb = this.configService.get<number>('REDIS_DB', 0);

      this.redisClient = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword || undefined,
        db: redisDb,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.redisClient.on('connect', () => {
        this.logger.log(`🟢 Connected to Redis at ${redisHost}:${redisPort}`);
      });

      this.redisClient.on('error', (error) => {
        this.logger.error(`🔥 Redis connection error: ${error.message}`);
      });

      this.redisClient.on('close', () => {
        this.logger.warn('🔌 Redis connection closed');
      });

      this.redisClient.on('reconnecting', () => {
        this.logger.log('🔄 Reconnecting to Redis...');
      });

      await this.redisClient.connect();
    } catch (error) {
      this.logger.error(`Failed to connect to Redis: ${error.message}`);
      this.logger.warn(
        'Continuing without Redis connection. Price updates will be logged but not published.',
      );
    }
  }

  private async disconnectFromRedis() {
    if (this.redisClient) {
      this.logger.log('Disconnecting from Redis...');
      await this.redisClient.quit();
    }
  }

  public async publishPriceUpdate(data: PriceUpdateData): Promise<void> {
    try {
      if (!this.redisClient || this.redisClient.status !== 'ready') {
        this.logger.warn('Redis client not ready, skipping price update');
        return;
      }

      const message = JSON.stringify({
        ...data,
        publishedAt: new Date().toISOString(),
      });

      await this.redisClient.publish(this.REDIS_CHANNEL, message);

      this.logger.verbose(
        `📡 Published price update: ${data.exchange.toUpperCase()} ${data.symbol.toUpperCase()} = ${data.price}`,
      );
    } catch (error) {
      this.logger.error(`Failed to publish price update: ${error.message}`);
    }
  }

  public async publishBatchPriceUpdates(
    dataArray: PriceUpdateData[],
  ): Promise<void> {
    try {
      if (!this.redisClient || this.redisClient.status !== 'ready') {
        this.logger.warn(
          'Redis client not ready, skipping batch price updates',
        );
        return;
      }

      const pipeline = this.redisClient.pipeline();

      for (const data of dataArray) {
        const message = JSON.stringify({
          ...data,
          publishedAt: new Date().toISOString(),
        });
        pipeline.publish(this.REDIS_CHANNEL, message);
      }

      await pipeline.exec();

      this.logger.verbose(
        `📡 Published batch price updates: ${dataArray.length} items`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish batch price updates: ${error.message}`,
      );
    }
  }

  public getRedisStatus(): string {
    return this.redisClient?.status || 'disconnected';
  }

  public async ping(): Promise<string | null> {
    try {
      if (!this.redisClient || this.redisClient.status !== 'ready') {
        return null;
      }
      return await this.redisClient.ping();
    } catch (error) {
      this.logger.error(`Redis ping failed: ${error.message}`);
      return null;
    }
  }
}
