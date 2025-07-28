import { Module } from '@nestjs/common';
import { KimpCoreService } from './kimp-core.service';
import { DatabaseModule } from './db/database.module';
import { AppConfigModule } from './config/config.module';
import { ExchangeModule } from './exchange/exchange.module';

@Module({
  imports: [DatabaseModule, AppConfigModule, ExchangeModule],
  providers: [KimpCoreService],
  exports: [KimpCoreService, DatabaseModule, AppConfigModule, ExchangeModule],
})
export class KimpCoreModule {}
