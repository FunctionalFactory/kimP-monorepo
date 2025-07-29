import { Controller, Get } from '@nestjs/common';
import { PriceFeedService } from '../price-feed/price-feed.service';
import { RedisPublisherService } from '../redis/redis-publisher.service';

interface HealthResponse {
  status: 'ok' | 'error';
  dependencies: {
    webSockets: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
  };
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
      const webSocketStatus = this.getWebSocketStatus();

      // Redis 연결 상태 확인
      const redisStatus = this.getRedisStatus();

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
      };
    } catch {
      return {
        status: 'error',
        dependencies: {
          webSockets: 'disconnected',
          redis: 'disconnected',
        },
      };
    }
  }

  private getWebSocketStatus(): 'connected' | 'disconnected' {
    try {
      // PriceFeedService의 WebSocket 연결 상태 확인
      const privateService = this.priceFeedService as any;
      const connectedSockets = privateService.connectedSockets;
      const totalRequiredConnections = privateService.totalRequiredConnections;

      if (connectedSockets && totalRequiredConnections) {
        return connectedSockets.size === totalRequiredConnections
          ? 'connected'
          : 'disconnected';
      }

      return 'disconnected';
    } catch {
      return 'disconnected';
    }
  }

  private getRedisStatus(): 'connected' | 'disconnected' {
    try {
      const redisStatus = this.redisPublisherService.getRedisStatus();
      return redisStatus === 'ready' ? 'connected' : 'disconnected';
    } catch {
      return 'disconnected';
    }
  }
}
