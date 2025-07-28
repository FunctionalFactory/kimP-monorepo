import { Module } from '@nestjs/common';
import { KimpCoreService } from './kimp-core.service';
import { AppConfigModule } from './config/config.module';
import { ExchangeModule } from './exchange/exchange.module';
import { UtilsModule } from './utils/utils.module';

@Module({
  imports: [AppConfigModule, ExchangeModule, UtilsModule],
  providers: [KimpCoreService],
  exports: [KimpCoreService, AppConfigModule, ExchangeModule, UtilsModule],
})
export class KimpCoreModule {}
