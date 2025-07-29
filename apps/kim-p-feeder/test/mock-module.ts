import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KimPFeederController } from '../src/kim-p-feeder.controller';
import { KimPFeederService } from '../src/kim-p-feeder.service';
import { HealthController } from '../src/health/health.controller';
import { PriceFeedService } from '../src/price-feed/price-feed.service';
import { RedisPublisherService } from '../src/redis/redis-publisher.service';

// Mock services for E2E testing
const mockPriceFeedService = {
  getWatchedSymbols: jest.fn().mockReturnValue(['BTC', 'ETH']),
  onModuleInit: jest.fn(),
  onModuleDestroy: jest.fn(),
  connectedSockets: new Set(['socket1', 'socket2']),
  totalRequiredConnections: 2,
};

const mockRedisPublisherService = {
  getRedisStatus: jest.fn().mockReturnValue('ready'),
  publishPriceUpdate: jest.fn(),
  publishBatchPriceUpdates: jest.fn(),
  ping: jest.fn(),
};

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [KimPFeederController, HealthController],
  providers: [
    KimPFeederService,
    {
      provide: PriceFeedService,
      useValue: mockPriceFeedService,
    },
    {
      provide: RedisPublisherService,
      useValue: mockRedisPublisherService,
    },
  ],
})
export class MockKimPFeederModule {}
