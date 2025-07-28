import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { SessionModule } from '../session/session.module';
import { MarketDataModule } from '../marketdata/marketdata.module';
import { CommonModule } from '../common/common.module';
import { ArbitrageModule } from '../arbitrage/arbitrage.module';

@Module({
  imports: [SessionModule, MarketDataModule, CommonModule, ArbitrageModule],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
