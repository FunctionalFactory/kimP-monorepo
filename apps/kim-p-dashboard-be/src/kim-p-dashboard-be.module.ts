import { Module } from '@nestjs/common';
import { KimPDashboardBeController } from './kim-p-dashboard-be.controller';
import { KimPDashboardBeService } from './kim-p-dashboard-be.service';
import { SettingsModule } from './settings/settings.module';
import { BacktestingModule } from './backtesting/backtesting.module';

@Module({
  imports: [SettingsModule, BacktestingModule],
  controllers: [KimPDashboardBeController],
  providers: [KimPDashboardBeService],
})
export class KimPDashboardBeModule {}
