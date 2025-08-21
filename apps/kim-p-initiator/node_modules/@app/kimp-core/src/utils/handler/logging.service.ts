import { Injectable, Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogContext {
  service: string;
  method?: string;
  cycleId?: string;
  sessionId?: string;
  symbol?: string;
  marketDirection?: 'NORMAL' | 'REVERSE';
  strategyType?: 'HIGH_PREMIUM' | 'LOW_PREMIUM';
  data?: any;
}

export interface AsyncLoggingContext {
  cycleId?: string;
  sessionId?: string;
  requestId?: string;
  userId?: string;
}

@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);
  private static asyncLocalStorage =
    new AsyncLocalStorage<AsyncLoggingContext>();

  /**
   * 비동기 컨텍스트에서 로깅을 실행합니다.
   * @param context 로깅 컨텍스트
   * @param callback 실행할 콜백 함수
   */
  public static run<T>(context: AsyncLoggingContext, callback: () => T): T {
    return this.asyncLocalStorage.run(context, callback);
  }

  /**
   * 현재 비동기 컨텍스트를 가져옵니다.
   */
  public static getContext(): AsyncLoggingContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * 일관된 형식의 로그 메시지를 생성합니다
   */
  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
    data?: any,
  ): string {
    const parts: string[] = [];

    // 로그 레벨
    parts.push(`[${level}]`);

    // AsyncLocalStorage에서 자동으로 cycleId 추출
    const asyncContext = LoggingService.getContext();
    const correlationId = asyncContext?.cycleId
      ? `[CYCLE:${asyncContext.cycleId}]`
      : '';

    // 컨텍스트 정보
    if (context) {
      if (context.service) parts.push(`[${context.service}]`);
      if (context.method) parts.push(`[${context.method}]`);
      if (context.cycleId) parts.push(`[CYCLE:${context.cycleId}]`);
      if (context.sessionId) parts.push(`[SESSION:${context.sessionId}]`);
      if (context.symbol) parts.push(`[${context.symbol.toUpperCase()}]`);
      if (context.marketDirection) parts.push(`[${context.marketDirection}]`);
      if (context.strategyType) parts.push(`[${context.strategyType}]`);
    }

    // 자동 추출된 correlation ID (컨텍스트에 cycleId가 없는 경우)
    if (correlationId && (!context || !context.cycleId)) {
      parts.push(correlationId);
    }

    // 메시지
    parts.push(message);

    // 데이터 (있는 경우)
    if (data) {
      parts.push(`| Data: ${JSON.stringify(data)}`);
    }

    return parts.join(' ');
  }

  /**
   * 디버그 로그
   */
  debug(message: string, context?: LogContext, data?: any): void {
    const formattedMessage = this.formatMessage(
      LogLevel.DEBUG,
      message,
      context,
      data,
    );
    this.logger.debug(formattedMessage);
  }

  /**
   * 정보 로그
   */
  info(message: string, context?: LogContext, data?: any): void {
    const formattedMessage = this.formatMessage(
      LogLevel.INFO,
      message,
      context,
      data,
    );
    this.logger.log(formattedMessage);
  }

  /**
   * 경고 로그
   */
  warn(message: string, context?: LogContext, data?: any): void {
    const formattedMessage = this.formatMessage(
      LogLevel.WARN,
      message,
      context,
      data,
    );
    this.logger.warn(formattedMessage);
  }

  /**
   * 에러 로그
   */
  error(
    message: string,
    error?: Error,
    context?: LogContext,
    data?: any,
  ): void {
    const formattedMessage = this.formatMessage(
      LogLevel.ERROR,
      message,
      context,
      data,
    );
    if (error) {
      this.logger.error(formattedMessage, error.stack);
    } else {
      this.logger.error(formattedMessage);
    }
  }

  /**
   * 거래 관련 로그 (특별한 형식)
   */
  trade(
    action: 'BUY' | 'SELL' | 'TRANSFER',
    exchange: 'UPBIT' | 'BINANCE',
    symbol: string,
    amount: number,
    price: number,
    context?: LogContext,
  ): void {
    const message = `${action} ${amount.toFixed(4)} ${symbol.toUpperCase()} @ ${price.toFixed(0)} KRW on ${exchange}`;
    this.info(message, { ...context, symbol });
  }

  /**
   * 수익/손실 로그 (특별한 형식)
   */
  profit(
    type: 'HIGH_PREMIUM' | 'LOW_PREMIUM' | 'TOTAL',
    profitKrw: number,
    profitPercent: number,
    context?: LogContext,
  ): void {
    const message = `${type} Profit: ${profitKrw.toFixed(0)} KRW (${profitPercent.toFixed(2)}%)`;
    this.info(message, context);
  }

  /**
   * 사이클 상태 변경 로그
   */
  cycleState(
    fromState: string,
    toState: string,
    cycleId: string,
    context?: LogContext,
  ): void {
    const message = `Cycle state changed: ${fromState} → ${toState}`;
    this.info(message, { ...context, cycleId });
  }

  /**
   * 세션 상태 변경 로그
   */
  sessionState(
    fromState: string,
    toState: string,
    sessionId: string,
    context?: LogContext,
  ): void {
    const message = `Session state changed: ${fromState} → ${toState}`;
    this.info(message, { ...context, sessionId });
  }
}
