// packages/kimp-core/src/utils/utils.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module';
import { AppConfigModule } from '../config/config.module';

// Calculator services
import { FeeCalculatorService } from './calculator/fee-calculator.service';
import { SlippageCalculatorService } from './calculator/slippage-calculator.service';

// External services
import { TelegramService } from './external/telegram.service';

// Handler services
import { ErrorHandlerService } from './handler/error-handler.service';
import { LoggingService } from './handler/logging.service';

// Service services
import { WithdrawalConstraintService } from './service/withdrawal-constraint.service';
import { PortfolioManagerService } from './service/portfolio-manager.service';

@Module({
  imports: [DatabaseModule, AppConfigModule],
  providers: [
    // Calculator services
    FeeCalculatorService,
    SlippageCalculatorService,

    // External services
    TelegramService,

    // Handler services
    ErrorHandlerService,
    LoggingService,

    // Service services
    WithdrawalConstraintService,
    PortfolioManagerService,
  ],
  exports: [
    // Calculator services
    FeeCalculatorService,
    SlippageCalculatorService,

    // External services
    TelegramService,

    // Handler services
    ErrorHandlerService,
    LoggingService,

    // Service services
    WithdrawalConstraintService,
    PortfolioManagerService,
  ],
})
export class UtilsModule {}
