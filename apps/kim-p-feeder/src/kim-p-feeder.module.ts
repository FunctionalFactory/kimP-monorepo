import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KimPFeederController } from './kim-p-feeder.controller';
import { KimPFeederService } from './kim-p-feeder.service';
import { PriceFeedModule } from './price-feed/price-feed.module';
import { RedisModule } from './redis/redis.module';
import { AppConfigModule } from '@app/kimp-core';
import { ExchangeModule } from '@app/kimp-core';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AppConfigModule,
    ExchangeModule,
    PriceFeedModule,
    RedisModule,
  ],
  controllers: [KimPFeederController],
  providers: [KimPFeederService],
})
export class KimPFeederModule {}
