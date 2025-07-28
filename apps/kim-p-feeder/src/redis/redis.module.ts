// apps/kim-p-feeder/src/redis/redis.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisPublisherService } from './redis-publisher.service';

@Module({
  imports: [ConfigModule],
  providers: [RedisPublisherService],
  exports: [RedisPublisherService],
})
export class RedisModule {}
