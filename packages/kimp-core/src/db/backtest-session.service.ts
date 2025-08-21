import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BacktestSession,
  BacktestSessionStatus,
} from './entities/backtest-session.entity';

@Injectable()
export class BacktestSessionService {
  constructor(
    @InjectRepository(BacktestSession)
    private readonly backtestSessionRepository: Repository<BacktestSession>,
  ) {}

  async create(data: {
    datasetId: string;
    parameters: BacktestSession['parameters'];
  }): Promise<BacktestSession> {
    const session = this.backtestSessionRepository.create({
      status: BacktestSessionStatus.PENDING,
      datasetId: data.datasetId,
      parameters: data.parameters,
    });
    return await this.backtestSessionRepository.save(session);
  }

  async findById(id: string): Promise<BacktestSession | null> {
    return await this.backtestSessionRepository.findOne({
      where: { id },
    });
  }

  async updateStatus(id: string, status: BacktestSessionStatus): Promise<void> {
    await this.backtestSessionRepository.update(id, { status });
  }

  async updateResults(
    id: string,
    results: BacktestSession['results'],
  ): Promise<void> {
    await this.backtestSessionRepository.update(id, {
      results,
      status: BacktestSessionStatus.COMPLETED,
      endTime: new Date(),
    });
  }

  async updateStartTime(id: string): Promise<void> {
    await this.backtestSessionRepository.update(id, {
      startTime: new Date(),
      status: BacktestSessionStatus.RUNNING,
    });
  }

  async updateEndTime(id: string): Promise<void> {
    await this.backtestSessionRepository.update(id, { endTime: new Date() });
  }

  async markAsFailed(id: string): Promise<void> {
    await this.backtestSessionRepository.update(id, {
      status: BacktestSessionStatus.FAILED,
      endTime: new Date(),
    });
  }

  async findAll(): Promise<BacktestSession[]> {
    return await this.backtestSessionRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findPendingSessions(): Promise<BacktestSession[]> {
    return await this.backtestSessionRepository.find({
      where: { status: BacktestSessionStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }

  async findRunningSessions(): Promise<BacktestSession[]> {
    return await this.backtestSessionRepository.find({
      where: { status: BacktestSessionStatus.RUNNING },
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.backtestSessionRepository.delete(id);
  }
}
