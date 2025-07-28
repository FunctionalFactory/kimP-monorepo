import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArbitrageCycle } from '../../db/entities/arbitrage-cycle.entity';
import { ArbitrageRecordService } from '../../db/arbitrage-record.service';
import { TelegramService } from '../external/telegram.service';

@Injectable()
export class RetryManagerService {
  private readonly logger = new Logger(RetryManagerService.name);
  private readonly MAX_RETRIES = 5;

  constructor(
    @InjectRepository(ArbitrageCycle)
    private readonly arbitrageCycleRepository: Repository<ArbitrageCycle>,
    private readonly arbitrageRecordService: ArbitrageRecordService,
    private readonly telegramService: TelegramService,
  ) {}

  /**
   * 사이클 실패 시 재시도 로직을 처리합니다.
   * @param cycle 실패한 사이클
   * @param error 발생한 에러
   */
  public async handleCycleFailure(
    cycle: ArbitrageCycle,
    error: Error,
  ): Promise<void> {
    this.logger.warn(
      `Handling failure for cycle ${cycle.id}: ${error.message}`,
    );

    // 재시도 횟수 증가
    cycle.retryCount += 1;
    cycle.failureReason = error.message;
    cycle.lastRetryAt = new Date();

    if (cycle.retryCount >= this.MAX_RETRIES) {
      // 최대 재시도 횟수 초과 시 Dead Letter Queue로 이동
      await this.moveToDeadLetterQueue(cycle, error);
    } else {
      // 재시도 가능한 경우 AWAITING_RETRY 상태로 설정
      await this.scheduleRetry(cycle);
    }

    // 사이클 상태 저장
    await this.arbitrageRecordService.updateArbitrageCycle(cycle.id, cycle);
  }

  /**
   * 사이클을 Dead Letter Queue로 이동시킵니다.
   */
  private async moveToDeadLetterQueue(
    cycle: ArbitrageCycle,
    error: Error,
  ): Promise<void> {
    cycle.status = 'DEAD_LETTER';
    cycle.nextRetryAt = null;

    this.logger.error(
      `Cycle ${cycle.id} moved to Dead Letter Queue after ${cycle.retryCount} retries. Final error: ${error.message}`,
    );

    // 텔레그램 알림 전송
    try {
      await this.telegramService.sendMessage(
        `🚨 **Dead Letter Queue Alert**\n\n` +
          `Cycle ID: \`${cycle.id}\`\n` +
          `Retry Count: ${cycle.retryCount}\n` +
          `Final Error: ${error.message}\n` +
          `Failure Reason: ${cycle.failureReason}\n\n` +
          `Manual intervention required!`,
      );
    } catch (telegramError) {
      this.logger.error(
        `Failed to send Telegram alert: ${telegramError.message}`,
      );
    }
  }

  /**
   * 사이클의 재시도를 스케줄링합니다.
   */
  private async scheduleRetry(cycle: ArbitrageCycle): Promise<void> {
    cycle.status = 'AWAITING_RETRY';

    // 지수 백오프 계산 (10분 * 2^retryCount)
    const delayMinutes = 10 * Math.pow(2, cycle.retryCount - 1);
    const nextRetryTime = new Date(Date.now() + delayMinutes * 60 * 1000);
    cycle.nextRetryAt = nextRetryTime;

    this.logger.log(
      `Scheduled retry for cycle ${cycle.id} in ${delayMinutes} minutes (retry ${cycle.retryCount}/${this.MAX_RETRIES})`,
    );
  }

  /**
   * 재시도 대기 중인 사이클들을 처리합니다.
   */
  public async processPendingRetries(): Promise<number> {
    const now = new Date();

    const pendingRetries = await this.arbitrageCycleRepository.find({
      where: {
        status: 'AWAITING_RETRY',
      },
      order: {
        nextRetryAt: 'ASC',
      },
    });

    let processedCount = 0;

    for (const cycle of pendingRetries) {
      if (cycle.nextRetryAt && cycle.nextRetryAt <= now) {
        // 재시도 시간이 된 사이클을 AWAITING_REBALANCE 상태로 변경
        cycle.status = 'AWAITING_REBALANCE';
        cycle.nextRetryAt = null;
        cycle.lockedAt = null; // 잠금 상태 초기화

        await this.arbitrageRecordService.updateArbitrageCycle(cycle.id, cycle);

        this.logger.log(
          `Cycle ${cycle.id} moved back to AWAITING_REBALANCE for retry ${cycle.retryCount}/${this.MAX_RETRIES}`,
        );

        processedCount++;
      }
    }

    if (processedCount > 0) {
      this.logger.log(`Processed ${processedCount} pending retries`);
    }

    return processedCount;
  }

  /**
   * Dead Letter Queue의 사이클들을 조회합니다.
   */
  public async getDeadLetterQueue(): Promise<ArbitrageCycle[]> {
    return this.arbitrageCycleRepository.find({
      where: {
        status: 'DEAD_LETTER',
      },
      order: {
        lastRetryAt: 'DESC',
      },
    });
  }

  /**
   * Dead Letter Queue에서 사이클을 수동으로 복구합니다.
   */
  public async recoverFromDeadLetter(cycleId: string): Promise<boolean> {
    const cycle = await this.arbitrageCycleRepository.findOne({
      where: { id: cycleId, status: 'DEAD_LETTER' },
    });

    if (!cycle) {
      this.logger.warn(`Cycle ${cycleId} not found in Dead Letter Queue`);
      return false;
    }

    // 재시도 상태 초기화
    cycle.status = 'AWAITING_REBALANCE';
    cycle.retryCount = 0;
    cycle.lastRetryAt = null;
    cycle.nextRetryAt = null;
    cycle.failureReason = null;
    cycle.lockedAt = null;

    await this.arbitrageRecordService.updateArbitrageCycle(cycle.id, cycle);

    this.logger.log(`Cycle ${cycleId} recovered from Dead Letter Queue`);

    // 텔레그램 알림 전송
    try {
      await this.telegramService.sendMessage(
        `✅ **Dead Letter Queue Recovery**\n\n` +
          `Cycle ID: \`${cycleId}\`\n` +
          `Status: Recovered and moved back to processing queue\n` +
          `Recovery Time: ${new Date().toISOString()}`,
      );
    } catch (telegramError) {
      this.logger.error(
        `Failed to send Telegram alert: ${telegramError.message}`,
      );
    }

    return true;
  }
}
