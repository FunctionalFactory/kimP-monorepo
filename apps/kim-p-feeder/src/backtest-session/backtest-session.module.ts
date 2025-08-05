import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/kimp-core';
import { BacktestSessionService } from './backtest-session.service';

@Module({
  imports: [ConfigModule.forRoot(), DatabaseModule],
  providers: [BacktestSessionService],
  exports: [BacktestSessionService],
})
export class BacktestSessionModule {}
