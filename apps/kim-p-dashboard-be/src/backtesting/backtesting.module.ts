import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/kimp-core';
import { BacktestingController } from './backtesting.controller';
import { CsvParsingService } from './csv-parsing.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
  ],
  controllers: [BacktestingController],
  providers: [CsvParsingService],
})
export class BacktestingModule {}
