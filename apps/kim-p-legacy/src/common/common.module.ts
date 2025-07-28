import { Module, forwardRef } from '@nestjs/common'; // forwardRef 추가
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpreadCalculatorService } from './spread-calculator.service';
import { ExchangeService } from './exchange.service';
import { FeeCalculatorService } from './fee-calculator.service';
import { SlippageCalculatorService } from './slippage-calculator.service';
import { StrategyHighService } from './strategy-high.service';
import { StrategyLowService } from './strategy-low.service';
import { ArbitrageService } from './arbitrage.service';
import { TelegramService } from './telegram.service';
import { WithdrawalConstraintService } from './withdrawal-constraint.service';
import { UpbitModule } from '../upbit/upbit.module';
import { BinanceModule } from '../binance/binance.module';
import { ArbitrageRecordService } from '../db/arbitrage-record.service';
import { ArbitrageCycle } from '../db/entities/arbitrage-cycle.entity';
import { LoggingService } from './logging.service';
import { ErrorHandlerService } from './error-handler.service';
import { PortfolioManagerService } from './portfolio-manager.service';
import { AppConfigModule } from '../config/config.module';
import { PortfolioLog } from 'src/db/entities/portfolio-log.entity';
import { PortfolioLogService } from 'src/db/portfolio-log.service';
import { MarketDataModule } from '../marketdata/marketdata.module'; // 추가

@Module({
  imports: [
    TypeOrmModule.forFeature([ArbitrageCycle, PortfolioLog]),
    UpbitModule,
    BinanceModule,
    forwardRef(() => MarketDataModule), // forwardRef로 감싸기
    AppConfigModule,
  ],
  providers: [
    SpreadCalculatorService,
    ExchangeService,
    FeeCalculatorService,
    SlippageCalculatorService,
    StrategyHighService,
    StrategyLowService,
    ArbitrageService,
    TelegramService,
    WithdrawalConstraintService,
    ArbitrageRecordService,
    PortfolioLogService,
    LoggingService,
    ErrorHandlerService,
    PortfolioManagerService,
  ],
  exports: [
    SpreadCalculatorService,
    ExchangeService,
    FeeCalculatorService,
    SlippageCalculatorService,
    StrategyHighService,
    StrategyLowService,
    ArbitrageService,
    TelegramService,
    WithdrawalConstraintService,
    ArbitrageRecordService,
    PortfolioLogService,
    LoggingService,
    ErrorHandlerService,
    PortfolioManagerService,
  ],
})
export class CommonModule {}
