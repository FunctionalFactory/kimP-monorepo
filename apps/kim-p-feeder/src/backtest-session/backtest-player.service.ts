import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import {
  BacktestSessionService,
  BacktestDatasetService,
  BacktestSessionStatus,
} from '@app/kimp-core';
import * as fs from 'fs';
import { promisify } from 'util';

interface BacktestSessionCreatedEvent {
  sessionId: string;
  datasetId: string;
}

interface CsvRow {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

@Injectable()
export class BacktestPlayerService {
  private readonly logger = new Logger(BacktestPlayerService.name);
  private readonly readFileAsync = promisify(fs.readFile);

  constructor(
    private readonly backtestSessionService: BacktestSessionService,
    private readonly backtestDatasetService: BacktestDatasetService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  @OnEvent('backtest.session.created')
  async handleBacktestSessionCreated(event: BacktestSessionCreatedEvent) {
    this.logger.log(`백테스트 세션 생성 이벤트 수신: ${event.sessionId}`);
    await this.run(event.sessionId);
  }

  async run(sessionId: string): Promise<void> {
    try {
      this.logger.log(`백테스트 플레이어 시작: ${sessionId}`);

      // 1. 세션 정보 조회
      const session = await this.backtestSessionService.findById(sessionId);
      if (!session) {
        throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
      }

      // 2. 데이터셋 정보 조회
      const dataset = await this.backtestDatasetService.findById(
        session.datasetId,
      );
      if (!dataset) {
        throw new Error(`데이터셋을 찾을 수 없습니다: ${session.datasetId}`);
      }

      // 3. 세션 상태를 RUNNING으로 업데이트
      await this.backtestSessionService.updateStartTime(sessionId);
      this.logger.log(`세션 상태를 RUNNING으로 업데이트: ${sessionId}`);

      // 4. CSV 파일 읽기 및 데이터 전송
      await this.processCsvFile(
        dataset.filePath,
        sessionId,
        session.parameters,
      );

      // 5. 세션 완료 처리
      await this.backtestSessionService.updateStatus(
        sessionId,
        BacktestSessionStatus.COMPLETED,
      );
      this.logger.log(`백테스트 세션 완료: ${sessionId}`);
    } catch (error) {
      this.logger.error(
        `백테스트 플레이어 오류: ${error.message}`,
        error.stack,
      );

      // 오류 발생 시 세션을 FAILED로 업데이트
      try {
        await this.backtestSessionService.markAsFailed(sessionId);
      } catch (updateError) {
        this.logger.error(`세션 상태 업데이트 실패: ${updateError.message}`);
      }

      throw error;
    }
  }

  private async processCsvFile(
    filePath: string,
    sessionId: string,
    parameters: any,
  ): Promise<void> {
    try {
      this.logger.log(`CSV 파일 처리 시작: ${filePath}`);

      const fileContent = await promisify(fs.readFile)(filePath, 'utf-8');
      const lines = fileContent.split('\n').filter((line) => line.trim());

      // 헤더 제거
      const headers = lines[0].split(',');
      const dataLines = lines.slice(1);

      let rowCount = 0;
      const batchSize = 100; // 배치 크기
      let currentBatch: CsvRow[] = [];

      for (const line of dataLines) {
        const values = line.split(',');
        if (values.length >= 6) {
          const row: CsvRow = {
            timestamp: values[0],
            open: parseFloat(values[1]) || 0,
            high: parseFloat(values[2]) || 0,
            low: parseFloat(values[3]) || 0,
            close: parseFloat(values[4]) || 0,
            volume: parseFloat(values[5]) || 0,
          };

          currentBatch.push(row);
          rowCount++;

          // 배치 크기에 도달하면 데이터 전송
          if (currentBatch.length >= batchSize) {
            await this.sendBatchToRedis(currentBatch, sessionId, parameters);
            currentBatch = []; // 배열 초기화
          }
        }
      }

      // 남은 데이터 전송
      if (currentBatch.length > 0) {
        await this.sendBatchToRedis(currentBatch, sessionId, parameters);
      }

      this.logger.log(`CSV 파일 처리 완료: ${rowCount}개 행 처리됨`);
    } catch (error) {
      this.logger.error(`CSV 파일 처리 오류: ${error.message}`);
      throw error;
    }
  }

  private async sendBatchToRedis(
    rows: CsvRow[],
    sessionId: string,
    parameters: any,
  ): Promise<void> {
    for (const row of rows) {
      try {
        // CSV 데이터를 Redis 메시지 형식으로 변환
        const priceData = {
          sessionId,
          timestamp: new Date(row.timestamp).toISOString(),
          symbol: 'ADA/KRW', // 기본값, 실제로는 데이터셋에서 추출해야 함
          exchange: 'UPBIT', // 기본값
          price: row.close,
          open: row.open,
          high: row.high,
          low: row.low,
          volume: row.volume,
          parameters, // 세션 파라미터 포함
        };

        // Redis로 데이터 전송 (이벤트 발생)
        this.eventEmitter.emit('price.update', priceData);

        // 실제 환경에서는 약간의 지연을 두어 시뮬레이션
        await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms 지연
      } catch (error) {
        this.logger.error(`데이터 전송 오류: ${error.message}`);
        throw error;
      }
    }
  }

  // 수동으로 세션을 시작하는 메서드 (테스트용)
  async startSession(sessionId: string): Promise<void> {
    this.logger.log(`수동으로 백테스트 세션 시작: ${sessionId}`);
    await this.run(sessionId);
  }
}
