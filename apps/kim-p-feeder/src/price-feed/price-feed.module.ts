// apps/kim-p-feeder/src/price-feed/price-feed.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PriceFeedService } from './price-feed.service';
import { AppConfigModule } from '@app/kimp-core';
import { ExchangeModule } from '@app/kimp-core';
import { DatabaseModule } from '@app/kimp-core';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    ConfigModule,
    AppConfigModule,
    ExchangeModule,
    DatabaseModule,
    RedisModule,
  ],
  providers: [PriceFeedService],
  exports: [PriceFeedService],
})
export class PriceFeedModule {}
