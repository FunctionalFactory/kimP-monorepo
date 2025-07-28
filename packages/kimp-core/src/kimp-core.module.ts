import { Module } from '@nestjs/common';
import { KimpCoreService } from './kimp-core.service';
import { DatabaseModule } from './db/database.module';
import { AppConfigModule } from './config/config.module';
import { ExchangeModule } from './exchange/exchange.module';
import { UtilsModule } from './utils/utils.module';

@Module({
  imports: [DatabaseModule, AppConfigModule, ExchangeModule, UtilsModule],
  providers: [KimpCoreService],
  exports: [
    KimpCoreService,
    DatabaseModule,
    AppConfigModule,
    ExchangeModule,
    UtilsModule,
  ],
})
export class KimpCoreModule {}
