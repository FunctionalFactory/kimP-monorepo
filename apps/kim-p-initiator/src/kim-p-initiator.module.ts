import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KimPInitiatorController } from './kim-p-initiator.controller';
import { KimPInitiatorService } from './kim-p-initiator.service';
import { AppConfigModule, ExchangeModule } from '@app/kimp-core';
import { RedisModule } from './redis/redis.module';
import { InitiatorModule } from './initiator/initiator.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AppConfigModule,
    ExchangeModule,
    RedisModule,
    InitiatorModule,
  ],
  controllers: [KimPInitiatorController],
  providers: [KimPInitiatorService],
})
export class KimPInitiatorModule {}
