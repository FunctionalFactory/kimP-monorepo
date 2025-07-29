import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { KimPFinalizerController } from './kim-p-finalizer.controller';
import { KimPFinalizerService } from './kim-p-finalizer.service';
import { AppConfigModule, ExchangeModule } from '@app/kimp-core';
import { SchedulerModule } from './scheduler/scheduler.module';
import { FinalizerModule } from './finalizer/finalizer.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    AppConfigModule,
    ExchangeModule,
    SchedulerModule,
    FinalizerModule,
  ],
  controllers: [KimPFinalizerController],
  providers: [KimPFinalizerService],
})
export class KimPFinalizerModule {}
