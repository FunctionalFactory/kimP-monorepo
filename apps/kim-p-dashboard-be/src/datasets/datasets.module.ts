import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BacktestDataset, BacktestDatasetService } from '@app/kimp-core';
import { DatasetsController } from './datasets.controller';
import { CsvParsingService } from './csv-parsing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BacktestDataset]),
    MulterModule.register({
      dest: './storage/datasets',
    }),
  ],
  controllers: [DatasetsController],
  providers: [BacktestDatasetService, CsvParsingService],
  exports: [BacktestDatasetService],
})
export class DatasetsModule {}
