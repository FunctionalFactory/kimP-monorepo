import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';

export interface PriceUpdateData {
  symbol: string;
  exchange: 'upbit' | 'binance';
  price: number;
  timestamp: number;
  publishedAt?: string;
}

@Injectable()
export class RedisSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisSubscriberService.name);
  private redisSub: Redis;
  private readonly CHANNEL = 'TICKER_UPDATES';

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.connectAndSubscribe();
  }

  async onModuleDestroy() {
    if (this.redisSub) {
      await this.redisSub.quit();
    }
  }

  private async connectAndSubscribe() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD', '');
    const db = this.configService.get<number>('REDIS_DB', 0);
    this.redisSub = new Redis({
      host,
      port,
      password: password || undefined,
      db,
    });

    this.redisSub.on('connect', () => {
      this.logger.log(`🟢 Connected to Redis for SUB at ${host}:${port}`);
    });
    this.redisSub.on('error', (err) => {
      this.logger.error(`Redis SUB error: ${err.message}`);
    });
    this.redisSub.on('close', () => {
      this.logger.warn('Redis SUB connection closed');
    });

    await this.redisSub.subscribe(this.CHANNEL);
    this.logger.log(`Subscribed to Redis channel: ${this.CHANNEL}`);
    this.redisSub.on('message', (channel, message) => {
      if (channel !== this.CHANNEL) return;
      try {
        const data: PriceUpdateData = JSON.parse(message);
        this.eventEmitter.emit('price.update', data);
      } catch (e) {
        this.logger.error(`Failed to parse price update: ${e}`);
      }
    });
  }
}
