import { Module } from '@nestjs/common';
import {
  AppConfigModule,
  ExchangeModule,
  UtilsModule,
  DatabaseModule,
} from '@app/kimp-core';
import { OpportunityScannerService } from './opportunity-scanner.service';
import { TradeExecutorService } from './trade-executor.service';

@Module({
  imports: [AppConfigModule, ExchangeModule, UtilsModule, DatabaseModule],
  providers: [OpportunityScannerService, TradeExecutorService],
  exports: [OpportunityScannerService, TradeExecutorService],
})
export class InitiatorModule {}
