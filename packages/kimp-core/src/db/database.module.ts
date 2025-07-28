// packages/kimp-core/src/db/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArbitrageCycle } from './entities/arbitrage-cycle.entity';
import { Trade } from './entities/trade.entity';
import { PortfolioLog } from './entities/portfolio-log.entity';
import { ArbitrageRecordService } from './arbitrage-record.service';
import { PortfolioLogService } from './portfolio-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([ArbitrageCycle, Trade, PortfolioLog])],
  providers: [ArbitrageRecordService, PortfolioLogService],
  exports: [ArbitrageRecordService, PortfolioLogService],
})
export class DatabaseModule {}
