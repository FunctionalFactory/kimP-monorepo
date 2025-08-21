import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from '@app/kimp-core';
import { FeederBacktestSessionService } from './backtest-session.service';
import { BacktestPlayerService } from './backtest-player.service';

@Module({
  imports: [ConfigModule.forRoot(), DatabaseModule, EventEmitterModule.forRoot()],
  providers: [FeederBacktestSessionService, BacktestPlayerService],
  exports: [FeederBacktestSessionService, BacktestPlayerService],
})
export class BacktestSessionModule {}
