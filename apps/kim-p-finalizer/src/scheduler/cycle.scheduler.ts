import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RetryManagerService } from '@app/kimp-core';
import { CycleFinderService } from '../finalizer/cycle-finder.service';

@Injectable()
export class CycleScheduler {
  private readonly logger = new Logger(CycleScheduler.name);

  constructor(
    private readonly retryManagerService: RetryManagerService,
    private readonly cycleFinderService: CycleFinderService,
  ) {}

  /**
   * 매분마다 재시도 대기 중인 사이클들을 처리합니다.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingRetries() {
    try {
      this.logger.debug('Starting pending retries processing...');

      const processedCount =
        await this.retryManagerService.processPendingRetries();

      if (processedCount > 0) {
        this.logger.log(
          `Successfully processed ${processedCount} pending retries`,
        );
      } else {
        this.logger.debug('No pending retries to process');
      }
    } catch (error) {
      this.logger.error(
        `Error processing pending retries: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 매 30초마다 대기 중인 사이클들을 처리합니다.
   */
  @Cron('*/30 * * * * *')
  async processPendingCycles() {
    try {
      this.logger.debug('Starting pending cycles processing...');

      const processedCycle =
        await this.cycleFinderService.findAndProcessPendingCycle();

      if (processedCycle) {
        this.logger.log(`Successfully processed cycle: ${processedCycle.id}`);
      } else {
        this.logger.debug('No pending cycles to process');
      }
    } catch (error) {
      this.logger.error(
        `Error processing pending cycles: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 매시간 Dead Letter Queue 상태를 체크합니다.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkDeadLetterQueue() {
    try {
      this.logger.debug('Checking Dead Letter Queue status...');

      const deadLetterCycles =
        await this.retryManagerService.getDeadLetterQueue();

      if (deadLetterCycles.length > 0) {
        this.logger.warn(
          `Found ${deadLetterCycles.length} cycles in Dead Letter Queue`,
        );

        // Dead Letter Queue에 있는 사이클들의 요약 정보 로깅
        const summary = deadLetterCycles.map((cycle) => ({
          id: cycle.id,
          retryCount: cycle.retryCount,
          failureReason: cycle.failureReason?.substring(0, 100) + '...',
          lastRetryAt: cycle.lastRetryAt,
        }));

        this.logger.warn('Dead Letter Queue Summary:', summary);
      } else {
        this.logger.debug('Dead Letter Queue is empty');
      }
    } catch (error) {
      this.logger.error(
        `Error checking Dead Letter Queue: ${error.message}`,
        error.stack,
      );
    }
  }
}
