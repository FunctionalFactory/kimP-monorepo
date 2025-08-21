import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BacktestDataset } from './entities/backtest-dataset.entity';

@Injectable()
export class BacktestDatasetService {
  constructor(
    @InjectRepository(BacktestDataset)
    private readonly backtestDatasetRepository: Repository<BacktestDataset>,
  ) {}

  async create(datasetData: Partial<BacktestDataset>): Promise<BacktestDataset> {
    const dataset = this.backtestDatasetRepository.create(datasetData);
    return await this.backtestDatasetRepository.save(dataset);
  }

  async findAll(): Promise<BacktestDataset[]> {
    return await this.backtestDatasetRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<BacktestDataset | null> {
    return await this.backtestDatasetRepository.findOne({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.backtestDatasetRepository.delete(id);
  }
}
