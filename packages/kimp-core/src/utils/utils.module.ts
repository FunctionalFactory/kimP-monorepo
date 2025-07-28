// packages/kimp-core/src/utils/utils.module.ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';

// Calculator services
import { FeeCalculatorService } from './calculator/fee-calculator.service';
import { SlippageCalculatorService } from './calculator/slippage-calculator.service';

// External services
import { TelegramService } from './external/telegram.service';

// Handler services
import { LoggingService } from './handler/logging.service';

// Service services
import { WithdrawalConstraintService } from './service/withdrawal-constraint.service';

@Module({
  imports: [AppConfigModule],
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
  ],
})
export class UtilsModule {}
