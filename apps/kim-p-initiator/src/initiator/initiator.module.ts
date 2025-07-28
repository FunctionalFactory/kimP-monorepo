import { Module } from '@nestjs/common';
import { AppConfigModule, ExchangeModule } from '@app/kimp-core';
import { OpportunityScannerService } from './opportunity-scanner.service';
import { TradeExecutorService } from './trade-executor.service';

@Module({
  imports: [AppConfigModule, ExchangeModule],
  providers: [OpportunityScannerService, TradeExecutorService],
  exports: [OpportunityScannerService, TradeExecutorService],
})
export class InitiatorModule {}
