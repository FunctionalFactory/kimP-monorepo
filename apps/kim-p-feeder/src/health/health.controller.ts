import { Controller, Get } from '@nestjs/common';
import { PriceFeedService } from '../price-feed/price-feed.service';
import { RedisPublisherService } from '../redis/redis-publisher.service';

interface HealthResponse {
  status: 'ok' | 'error';
  dependencies: {
    webSockets: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
  };
  uptime: number;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly priceFeedService: PriceFeedService,
    private readonly redisPublisherService: RedisPublisherService,
  ) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    try {
      // WebSocket 연결 상태 확인
      const webSocketStatus = this.priceFeedService.getConnectionStatus();

      // Redis 연결 상태 확인
      const redisStatus = this.redisPublisherService.getRedisStatus();

      // 전체 상태 결정
      const overallStatus =
        webSocketStatus === 'connected' && redisStatus === 'connected'
          ? 'ok'
          : 'error';

      return {
        status: overallStatus,
        dependencies: {
          webSockets: webSocketStatus,
          redis: redisStatus,
        },
        uptime: process.uptime(),
      };
    } catch {
      return {
        status: 'error',
        dependencies: {
          webSockets: 'disconnected',
          redis: 'disconnected',
        },
        uptime: process.uptime(),
      };
    }
  }
}
