import { Injectable, Logger } from '@nestjs/common';
import {
  ExchangeService,
  InvestmentConfigService,
  TelegramService,
  FeeCalculatorService,
  SlippageCalculatorService,
  WithdrawalConstraintService,
  LoggingService,
} from '@app/kimp-core';

@Injectable()
export class TestInjectionService {
  private readonly logger = new Logger(TestInjectionService.name);

  constructor(
    private readonly exchangeService: ExchangeService,
    private readonly investmentConfigService: InvestmentConfigService,
    private readonly telegramService: TelegramService,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly slippageCalculatorService: SlippageCalculatorService,
    private readonly withdrawalConstraintService: WithdrawalConstraintService,
    private readonly loggingService: LoggingService,
  ) {
    this.logger.log('All core services have been successfully injected!');
    this.logger.log(
      '✅ ExchangeService: ' + (exchangeService ? 'Injected' : 'Failed'),
    );
    this.logger.log(
      '✅ InvestmentConfigService: ' +
        (investmentConfigService ? 'Injected' : 'Failed'),
    );
    this.logger.log(
      '✅ TelegramService: ' + (telegramService ? 'Injected' : 'Failed'),
    );
    this.logger.log(
      '✅ FeeCalculatorService: ' +
        (feeCalculatorService ? 'Injected' : 'Failed'),
    );
    this.logger.log(
      '✅ SlippageCalculatorService: ' +
        (slippageCalculatorService ? 'Injected' : 'Failed'),
    );
    this.logger.log(
      '✅ WithdrawalConstraintService: ' +
        (withdrawalConstraintService ? 'Injected' : 'Failed'),
    );
    this.logger.log(
      '✅ LoggingService: ' + (loggingService ? 'Injected' : 'Failed'),
    );
  }
}
