// packages/kimp-core/src/utils/utils.module.ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { DatabaseModule } from '../db/database.module';

// Calculator services
import { FeeCalculatorService } from './calculator/fee-calculator.service';
import { SlippageCalculatorService } from './calculator/slippage-calculator.service';

// External services
import { TelegramService } from './external/telegram.service';

// Handler services
import { LoggingService } from './handler/logging.service';

// Service services
import { WithdrawalConstraintService } from './service/withdrawal-constraint.service';
import { RetryManagerService } from './service/retry-manager.service';
import { DistributedLockService } from './service/distributed-lock.service';

@Module({
  imports: [AppConfigModule, DatabaseModule],
  providers: [
    // Calculator services
    FeeCalculatorService,
    SlippageCalculatorService,

    // External services
    TelegramService,

    // Handler services
    LoggingService,

    // Service services
    WithdrawalConstraintService,
    RetryManagerService,
    DistributedLockService,
  ],
  exports: [
    // Calculator services
    FeeCalculatorService,
    SlippageCalculatorService,

    // External services
    TelegramService,

    // Handler services
    LoggingService,

    // Service services
    WithdrawalConstraintService,
    RetryManagerService,
    DistributedLockService,
  ],
})
export class UtilsModule {}
