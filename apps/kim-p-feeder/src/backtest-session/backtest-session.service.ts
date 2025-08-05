import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BacktestSessionService, CandlestickService } from '@app/kimp-core';

@Injectable()
export class BacktestSessionService {
  private readonly logger = new Logger(BacktestSessionService.name);
  private currentSessionId: string | null = null;
  private currentSessionData: any = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly backtestSessionService: BacktestSessionService,
    private readonly candlestickService: CandlestickService,
  ) {}

  async initializeSession(): Promise<void> {
    const sessionId = this.configService.get<string>('SESSION_ID');

    if (!sessionId) {
      this.logger.warn(
        'SESSION_ID가 설정되지 않았습니다. 백테스트 모드가 비활성화됩니다.',
      );
      return;
    }

    try {
      const session = await this.backtestSessionService.findById(sessionId);

      if (!session) {
        this.logger.error(`세션 ID ${sessionId}를 찾을 수 없습니다.`);
        return;
      }

      if (session.status !== 'PENDING') {
        this.logger.warn(
          `세션 ${sessionId}는 이미 처리되었습니다. 상태: ${session.status}`,
        );
        return;
      }

      this.currentSessionId = sessionId;
      this.currentSessionData = session;

      // 세션 상태를 RUNNING으로 업데이트
      await this.backtestSessionService.updateStartTime(sessionId);

      this.logger.log(`백테스트 세션 ${sessionId} 초기화 완료`);
      this.logger.log(`파라미터: ${JSON.stringify(session.parameters)}`);
    } catch (error) {
      this.logger.error(`세션 초기화 오류: ${error.message}`);
    }
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  getCurrentSessionData(): any {
    return this.currentSessionData;
  }

  async getCandlestickData(): Promise<any[]> {
    if (!this.currentSessionData) {
      this.logger.warn('현재 세션 데이터가 없습니다.');
      return [];
    }

    const { upbitSymbol, binanceSymbol, timeframe, startDate, endDate } =
      this.currentSessionData.parameters;

    try {
      // Upbit와 Binance 데이터 모두 가져오기
      const upbitData = await this.candlestickService.findByExchangeAndSymbol(
        'upbit',
        upbitSymbol,
        timeframe,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
      );

      const binanceData = await this.candlestickService.findByExchangeAndSymbol(
        'binance',
        binanceSymbol,
        timeframe,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
      );

      this.logger.log(
        `Upbit 데이터: ${upbitData.length}개, Binance 데이터: ${binanceData.length}개`,
      );

      // 두 데이터를 타임스탬프별로 병합
      const mergedData = this.mergeCandlestickData(upbitData, binanceData);

      return mergedData;
    } catch (error) {
      this.logger.error(`캔들스틱 데이터 조회 오류: ${error.message}`);
      return [];
    }
  }

  private mergeCandlestickData(upbitData: any[], binanceData: any[]): any[] {
    const merged = [];
    const upbitMap = new Map();
    const binanceMap = new Map();

    // Upbit 데이터를 맵으로 변환
    upbitData.forEach((data) => {
      const key = data.timestamp.getTime();
      upbitMap.set(key, data);
    });

    // Binance 데이터를 맵으로 변환
    binanceData.forEach((data) => {
      const key = data.timestamp.getTime();
      binanceMap.set(key, data);
    });

    // 모든 타임스탬프를 수집
    const allTimestamps = new Set([...upbitMap.keys(), ...binanceMap.keys()]);

    // 타임스탬프별로 정렬하여 병합
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    for (const timestamp of sortedTimestamps) {
      const upbitData = upbitMap.get(timestamp);
      const binanceData = binanceMap.get(timestamp);

      merged.push({
        timestamp: new Date(timestamp),
        upbit: upbitData,
        binance: binanceData,
      });
    }

    return merged;
  }

  async markSessionAsCompleted(results: any): Promise<void> {
    if (!this.currentSessionId) {
      return;
    }

    try {
      await this.backtestSessionService.updateResults(
        this.currentSessionId,
        results,
      );
      this.logger.log(`백테스트 세션 ${this.currentSessionId} 완료 처리됨`);
    } catch (error) {
      this.logger.error(`세션 완료 처리 오류: ${error.message}`);
    }
  }

  async markSessionAsFailed(): Promise<void> {
    if (!this.currentSessionId) {
      return;
    }

    try {
      await this.backtestSessionService.markAsFailed(this.currentSessionId);
      this.logger.log(`백테스트 세션 ${this.currentSessionId} 실패 처리됨`);
    } catch (error) {
      this.logger.error(`세션 실패 처리 오류: ${error.message}`);
    }
  }
}
