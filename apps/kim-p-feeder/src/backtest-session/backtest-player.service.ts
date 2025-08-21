import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { BacktestSessionService, BacktestDatasetService } from '@app/kimp-core';
import * as fs from 'fs';
import * as csv from 'csv-parser';
import { createReadStream } from 'fs';
import { promisify } from 'util';

interface BacktestSessionCreatedEvent {
  sessionId: string;
  datasetId: string;
}

interface CsvRow {
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
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
      const dataset = await this.backtestDatasetService.findById(session.datasetId);
      if (!dataset) {
        throw new Error(`데이터셋을 찾을 수 없습니다: ${session.datasetId}`);
      }

      // 3. 세션 상태를 RUNNING으로 업데이트
      await this.backtestSessionService.updateStartTime(sessionId);
      this.logger.log(`세션 상태를 RUNNING으로 업데이트: ${sessionId}`);

      // 4. CSV 파일 읽기 및 데이터 전송
      await this.processCsvFile(dataset.filePath, sessionId, session.parameters);

      // 5. 세션 완료 처리
      await this.backtestSessionService.updateStatus(sessionId, 'COMPLETED');
      this.logger.log(`백테스트 세션 완료: ${sessionId}`);

    } catch (error) {
      this.logger.error(`백테스트 플레이어 오류: ${error.message}`, error.stack);
      
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
    return new Promise((resolve, reject) => {
      const results: CsvRow[] = [];
      let rowCount = 0;
      const batchSize = 100; // 배치 크기

      this.logger.log(`CSV 파일 처리 시작: ${filePath}`);

      createReadStream(filePath)
        .pipe(csv())
        .on('data', (row: CsvRow) => {
          results.push(row);
          rowCount++;

          // 배치 크기에 도달하면 데이터 전송
          if (results.length >= batchSize) {
            this.sendBatchToRedis(results, sessionId, parameters);
            results.length = 0; // 배열 초기화
          }
        })
        .on('end', async () => {
          try {
            // 남은 데이터 전송
            if (results.length > 0) {
              await this.sendBatchToRedis(results, sessionId, parameters);
            }

            this.logger.log(`CSV 파일 처리 완료: ${rowCount}개 행 처리됨`);
            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          this.logger.error(`CSV 파일 읽기 오류: ${error.message}`);
          reject(error);
        });
    });
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
          price: parseFloat(row.close),
          open: parseFloat(row.open),
          high: parseFloat(row.high),
          low: parseFloat(row.low),
          volume: parseFloat(row.volume),
          parameters, // 세션 파라미터 포함
        };

        // Redis로 데이터 전송 (이벤트 발생)
        this.eventEmitter.emit('price.update', priceData);

        // 실제 환경에서는 약간의 지연을 두어 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms 지연

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
