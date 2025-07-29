import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PriceFeedModule } from '../price-feed/price-feed.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PriceFeedModule, RedisModule],
  controllers: [HealthController],
})
export class HealthModule {}
