import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/kimp-core';
import { FeederBacktestSessionService } from './backtest-session.service';

@Module({
  imports: [ConfigModule.forRoot(), DatabaseModule],
  providers: [FeederBacktestSessionService],
  exports: [FeederBacktestSessionService],
})
export class BacktestSessionModule {}
