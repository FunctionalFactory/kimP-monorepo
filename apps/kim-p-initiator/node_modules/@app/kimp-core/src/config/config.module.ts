import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InvestmentConfigService } from './investment-config.service';

@Module({
  imports: [ConfigModule],
  providers: [InvestmentConfigService],
  exports: [InvestmentConfigService],
})
export class AppConfigModule {}
