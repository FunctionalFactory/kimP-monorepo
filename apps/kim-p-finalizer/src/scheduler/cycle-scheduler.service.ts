import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FinalizerService } from '../finalizer/finalizer.service';

@Injectable()
export class CycleSchedulerService {
  private readonly logger = new Logger(CycleSchedulerService.name);

  constructor(private readonly finalizerService: FinalizerService) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleCycleProcessing() {
    this.logger.debug('🔄 스케줄러: 대기 중인 차익거래 사이클 처리 시작');

    try {
      await this.finalizerService.processPendingCycles();
    } catch (error) {
      this.logger.error(
        `❌ 사이클 처리 중 오류 발생: ${error.message}`,
        error.stack,
      );
    }
  }
}
