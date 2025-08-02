// packages/kimp-core/src/utils/utils.module.ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { ExchangeModule } from '../exchange/exchange.module';
import { DatabaseModule } from '../db/database.module';
import { FeeCalculatorService } from './calculator/fee-calculator.service';
import { SlippageCalculatorService } from './calculator/slippage-calculator.service';
import { SpreadCalculatorService } from './calculator/spread-calculator.service';
import { LoggingService } from './handler/logging.service';
import { ErrorHandlerService } from './handler/error-handler.service';
import { TelegramService } from './external/telegram.service';
import { PortfolioManagerService } from './service/portfolio-manager.service';
import { RetryManagerService } from './service/retry-manager.service';
import { WithdrawalConstraintService } from './service/withdrawal-constraint.service';
import { DistributedLockService } from './service/distributed-lock.service';
import { StrategyHighService } from './service/strategy-high.service';
import { StrategyLowService } from './service/strategy-low.service';
import { SettingsService } from './service/settings.service';

@Module({
  imports: [AppConfigModule, ExchangeModule, DatabaseModule],
  providers: [
    FeeCalculatorService,
    SlippageCalculatorService,
    SpreadCalculatorService,
    LoggingService,
    ErrorHandlerService,
    TelegramService,
    PortfolioManagerService,
    RetryManagerService,
    WithdrawalConstraintService,
    DistributedLockService,
    StrategyHighService,
    StrategyLowService,
    SettingsService,
  ],
  exports: [
    FeeCalculatorService,
    SlippageCalculatorService,
    SpreadCalculatorService,
    LoggingService,
    ErrorHandlerService,
    TelegramService,
    PortfolioManagerService,
    RetryManagerService,
    WithdrawalConstraintService,
    DistributedLockService,
    StrategyHighService,
    StrategyLowService,
    SettingsService,
  ],
})
export class UtilsModule {}
