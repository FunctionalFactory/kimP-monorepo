import { Module } from '@nestjs/common';
import { SessionManagerService } from './session-manager.service';
import { SessionStateService } from './session-state.service';
import { SessionPriorityService } from './session-priority.service';
import { SessionExecutorService } from './session-executor.service';
import { ArbitrageModule } from '../arbitrage/arbitrage.module';
import { MarketDataModule } from '../marketdata/marketdata.module';
import { CommonModule } from '../common/common.module';
import { SessionFundValidationService } from 'src/db/session-fund-validation.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionFundValidation } from 'src/db/entities/session-fund-validation.entity';
import { AppConfigModule } from '../config/config.module'; // 추가

@Module({
  imports: [
    ArbitrageModule,
    MarketDataModule,
    CommonModule,
    TypeOrmModule.forFeature([SessionFundValidation]),
    AppConfigModule,
  ],
  providers: [
    SessionManagerService,
    SessionStateService,
    SessionPriorityService,
    SessionExecutorService,
    SessionFundValidationService,
  ],
  exports: [SessionManagerService, SessionStateService, SessionExecutorService],
})
export class SessionModule {}
