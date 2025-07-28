import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { ArbitrageRecordService } from '../db/arbitrage-record.service';

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ErrorCategory {
  NETWORK = 'NETWORK',
  API = 'API',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  DATABASE = 'DATABASE',
  VALIDATION = 'VALIDATION',
  SYSTEM = 'SYSTEM',
}

export interface ErrorContext {
  cycleId?: string;
  sessionId?: string;
  symbol?: string;
  exchange?: 'UPBIT' | 'BINANCE';
  operation?: string;
  stage?: 'HIGH_PREMIUM' | 'LOW_PREMIUM' | 'TRANSFER' | 'MONITORING';
}

export interface ErrorInfo {
  error: Error;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context?: ErrorContext;
  recoverable?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

@Injectable()
export class ErrorHandlerService {
  private readonly logger = new Logger(ErrorHandlerService.name);
  private readonly errorCounts = new Map<string, number>();
  private readonly lastErrorTime = new Map<string, number>();

  constructor(
    private readonly telegramService: TelegramService,
    private readonly arbitrageRecordService: ArbitrageRecordService,
  ) {}

  /**
   * 에러를 처리하고 적절한 복구 조치를 수행합니다
   */
  async handleError(errorInfo: ErrorInfo): Promise<void> {
    const {
      error,
      severity,
      // category,
      context,
      recoverable = true,
      retryCount = 0,
      maxRetries = 3,
    } = errorInfo;

    // 에러 키 생성 (중복 알림 방지용)
    const errorKey = this.generateErrorKey(error, context);
    const currentTime = Date.now();
    const lastError = this.lastErrorTime.get(errorKey) || 0;

    // 5분 내 동일 에러는 중복 알림 방지
    if (currentTime - lastError < 300000) {
      this.logger.debug(`[ERROR_HANDLER] 중복 에러 알림 방지: ${errorKey}`);
      return;
    }

    // 에러 카운트 증가
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
    this.lastErrorTime.set(errorKey, currentTime);

    // 로그 출력
    this.logError(errorInfo);

    // 텔레그램 알림 (심각도에 따라)
    if (
      severity === ErrorSeverity.HIGH ||
      severity === ErrorSeverity.CRITICAL
    ) {
      await this.sendTelegramAlert(errorInfo);
    }

    // DB 상태 업데이트 (사이클 관련 에러인 경우)
    if (context?.cycleId) {
      await this.updateCycleStatus(errorInfo);
    }

    // 복구 가능한 에러인지 확인
    if (recoverable && retryCount < maxRetries) {
      this.logger.debug(
        `[ERROR_HANDLER] 복구 가능한 에러. 재시도 ${retryCount + 1}/${maxRetries}`,
      );
      return;
    }

    // 복구 불가능한 에러 처리
    if (!recoverable || retryCount >= maxRetries) {
      await this.handleUnrecoverableError(errorInfo);
    }
  }

  /**
   * 네트워크/API 에러 처리
   */
  async handleNetworkError(
    error: Error,
    context?: ErrorContext,
  ): Promise<void> {
    const errorInfo: ErrorInfo = {
      error,
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.NETWORK,
      context,
      recoverable: true,
      maxRetries: 3,
    };

    await this.handleError(errorInfo);
  }

  /**
   * 거래 관련 에러 처리
   */
  async handleTradeError(error: Error, context?: ErrorContext): Promise<void> {
    const errorMessage = error.message.toLowerCase();

    // 송금 후 에러는 치명적
    const isAfterTransfer =
      errorMessage.includes('after withdrawal') ||
      errorMessage.includes('송금 후') ||
      errorMessage.includes('transfer completed');

    const errorInfo: ErrorInfo = {
      error,
      severity: isAfterTransfer ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH,
      category: ErrorCategory.BUSINESS_LOGIC,
      context,
      recoverable: !isAfterTransfer,
      maxRetries: isAfterTransfer ? 0 : 2,
    };

    await this.handleError(errorInfo);
  }

  /**
   * 잔고 부족 에러 처리
   */
  async handleInsufficientFundsError(
    error: Error,
    context?: ErrorContext,
  ): Promise<void> {
    const errorInfo: ErrorInfo = {
      error,
      severity: ErrorSeverity.HIGH,
      category: ErrorCategory.BUSINESS_LOGIC,
      context,
      recoverable: false,
    };

    await this.handleError(errorInfo);
  }

  /**
   * 에러 로그 출력
   */
  private logError(errorInfo: ErrorInfo): void {
    const { error, severity, category, context } = errorInfo;

    const contextStr = context
      ? `[${context.cycleId || 'N/A'}] [${context.sessionId || 'N/A'}] [${context.symbol || 'N/A'}]`
      : '';

    const message = `[${severity}] [${category}] ${contextStr} ${error.message}`;

    switch (severity) {
      case ErrorSeverity.LOW:
        this.logger.debug(message);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn(message);
        break;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        this.logger.error(message, error.stack);
        break;
    }
  }

  /**
   * 텔레그램 알림 전송
   */
  private async sendTelegramAlert(errorInfo: ErrorInfo): Promise<void> {
    const { error, severity, category, context } = errorInfo;

    const emoji = severity === ErrorSeverity.CRITICAL ? '��' : '⚠️';
    const contextStr = context
      ? `\n• 사이클: ${context.cycleId || 'N/A'}` +
        `\n• 세션: ${context.sessionId || 'N/A'}` +
        `\n• 코인: ${context.symbol || 'N/A'}` +
        `\n• 거래소: ${context.exchange || 'N/A'}` +
        `\n• 단계: ${context.stage || 'N/A'}`
      : '';

    const message =
      `${emoji} *${severity} ${category} 에러*\n\n` +
      `�� ${error.message}${contextStr}\n\n` +
      `⏰ ${new Date().toLocaleString('ko-KR')}`;

    try {
      await this.telegramService.sendMessage(message);
    } catch (telegramError) {
      this.logger.error('텔레그램 알림 전송 실패:', telegramError);
    }
  }

  /**
   * 사이클 상태 업데이트
   */
  private async updateCycleStatus(errorInfo: ErrorInfo): Promise<void> {
    const { error, severity, context } = errorInfo;

    if (!context?.cycleId) return;

    try {
      const status =
        severity === ErrorSeverity.CRITICAL ? 'FAILED' : 'AWAITING_LP';
      const errorDetails = `${severity} ${errorInfo.category}: ${error.message}`;

      await this.arbitrageRecordService.updateArbitrageCycle(context.cycleId, {
        status,
        errorDetails,
        endTime: severity === ErrorSeverity.CRITICAL ? new Date() : undefined,
      });
    } catch (dbError) {
      this.logger.error('사이클 상태 업데이트 실패:', dbError);
    }
  }

  /**
   * 복구 불가능한 에러 처리
   */
  private async handleUnrecoverableError(errorInfo: ErrorInfo): Promise<void> {
    const { error, context } = errorInfo;

    this.logger.error(`[ERROR_HANDLER] 복구 불가능한 에러: ${error.message}`);

    // 사이클이 있다면 FAILED로 설정
    if (context?.cycleId) {
      await this.arbitrageRecordService.updateArbitrageCycle(context.cycleId, {
        status: 'FAILED',
        errorDetails: `Unrecoverable error: ${error.message}`,
        endTime: new Date(),
      });
    }
  }

  /**
   * 에러 키 생성
   */
  private generateErrorKey(error: Error, context?: ErrorContext): string {
    const baseKey = `${error.message}_${context?.symbol || 'N/A'}_${context?.exchange || 'N/A'}`;
    return baseKey.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * 에러 통계 조회
   */
  getErrorStats(): { [key: string]: number } {
    const stats: { [key: string]: number } = {};
    for (const [key, count] of this.errorCounts.entries()) {
      stats[key] = count;
    }
    return stats;
  }

  /**
   * 에러 카운트 초기화
   */
  clearErrorCounts(): void {
    this.errorCounts.clear();
    this.lastErrorTime.clear();
  }
}
