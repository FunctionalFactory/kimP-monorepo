import { Module } from '@nestjs/common';
import { KimpCoreService } from './kimp-core.service';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './db/database.module';
import { ExchangeModule } from './exchange/exchange.module';
import { UtilsModule } from './utils/utils.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, ExchangeModule, UtilsModule],
  providers: [KimpCoreService],
  exports: [
    KimpCoreService,
    AppConfigModule,
    DatabaseModule,
    ExchangeModule,
    UtilsModule,
  ],
})
export class KimpCoreModule {}
