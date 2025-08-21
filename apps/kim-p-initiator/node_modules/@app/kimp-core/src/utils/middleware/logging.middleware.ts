import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {
  LoggingService,
  AsyncLoggingContext,
} from '../handler/logging.service';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    // HTTP 헤더에서 cycle-id 추출
    const cycleId =
      (req.headers['cycle-id'] as string) ||
      (req.headers['x-cycle-id'] as string) ||
      (req.body?.cycleId as string);

    // 요청 ID 생성 (없는 경우)
    const requestId =
      (req.headers['x-request-id'] as string) || this.generateRequestId();

    // 세션 ID 추출
    const sessionId =
      (req.headers['session-id'] as string) ||
      (req.headers['x-session-id'] as string);

    // 사용자 ID 추출 (인증된 경우)
    const userId =
      (req.headers['user-id'] as string) ||
      (req.headers['x-user-id'] as string) ||
      (req as any).user?.id;

    // 로깅 컨텍스트 생성
    const loggingContext: AsyncLoggingContext = {
      cycleId,
      requestId,
      sessionId,
      userId,
    };

    // AsyncLocalStorage 컨텍스트에서 요청 처리
    LoggingService.run(loggingContext, () => {
      // 요청 시작 로깅
      this.logger.log(
        `HTTP ${req.method} ${req.url} - CycleId: ${cycleId || 'N/A'} - RequestId: ${requestId}`,
      );

      // 응답 완료 시 로깅
      res.on('finish', () => {
        this.logger.log(
          `HTTP ${req.method} ${req.url} - Status: ${res.statusCode} - CycleId: ${cycleId || 'N/A'} - RequestId: ${requestId}`,
        );
      });

      // 다음 미들웨어로 진행
      next();
    });
  }

  /**
   * 고유한 요청 ID를 생성합니다.
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
