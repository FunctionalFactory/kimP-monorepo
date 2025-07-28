import { Injectable, Logger } from '@nestjs/common';
import {
  ArbitrageRecordService,
  LoggingService,
  ArbitrageCycle,
} from '@app/kimp-core';

@Injectable()
export class CycleFinderService {
  private readonly logger = new Logger(CycleFinderService.name);

  constructor(
    private readonly arbitrageRecordService: ArbitrageRecordService,
  ) {}

  /**
   * 대기 중인 사이클을 찾아서 처리합니다.
   */
  async findAndProcessPendingCycle(): Promise<ArbitrageCycle | null> {
    try {
      // 대기 중인 사이클을 찾아서 잠금
      const cycle = await this.arbitrageRecordService.findAndLockNextCycle();

      if (!cycle) {
        this.logger.debug('No pending cycles found for processing');
        return null;
      }

      // LoggingService.run을 사용하여 컨텍스트 설정
      return LoggingService.run({ cycleId: cycle.id }, async () => {
        this.logger.log(
          `Processing cycle ${cycle.id} - Status: ${cycle.status}`,
        );

        try {
          // 사이클 처리 로직
          await this.processCycle(cycle);

          this.logger.log(`Cycle ${cycle.id} processed successfully`);

          return await this.arbitrageRecordService.getArbitrageCycle(cycle.id);
        } catch (error) {
          this.logger.error(
            `Failed to process cycle ${cycle.id}: ${error.message}`,
            error.stack,
          );

          // 사이클을 FAILED 상태로 변경
          await this.arbitrageRecordService.updateArbitrageCycle(cycle.id, {
            status: 'FAILED',
            errorDetails: error.message,
          });

          throw error;
        }
      });
    } catch (error) {
      this.logger.error(
        `Error in findAndProcessPendingCycle: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * 사이클을 처리합니다.
   */
  private async processCycle(cycle: ArbitrageCycle): Promise<void> {
    this.logger.log(`Starting cycle processing for ${cycle.id}`);

    // 사이클 상태에 따른 처리
    switch (cycle.status) {
      case 'REBALANCING_IN_PROGRESS':
        await this.processRebalancing(cycle);
        break;
      case 'AWAITING_REBALANCE':
        await this.processRebalance(cycle);
        break;
      default:
        this.logger.warn(
          `Unexpected cycle status: ${cycle.status} for cycle ${cycle.id}`,
        );
    }
  }

  /**
   * 재조정 처리를 시작합니다.
   */
  private async processRebalancing(cycle: ArbitrageCycle): Promise<void> {
    this.logger.log(`Processing rebalancing for cycle ${cycle.id}`);

    // 재조정 로직 (시뮬레이션)
    await this.simulateRebalancing(cycle);

    // 사이클 상태를 REBALANCE_TRADE_COMPLETED로 업데이트
    await this.arbitrageRecordService.updateArbitrageCycle(cycle.id, {
      status: 'REBALANCE_TRADE_COMPLETED',
    });

    this.logger.log(`Rebalancing completed for cycle ${cycle.id}`);
  }

  /**
   * 재조정을 시뮬레이션합니다.
   */
  private async simulateRebalancing(cycle: ArbitrageCycle): Promise<void> {
    this.logger.log(`Simulating rebalancing for cycle ${cycle.id}`);

    // 시뮬레이션 지연
    await new Promise((resolve) => setTimeout(resolve, 200));

    this.logger.log(`Rebalancing simulation completed for cycle ${cycle.id}`);
  }

  /**
   * 재조정을 처리합니다.
   */
  private async processRebalance(cycle: ArbitrageCycle): Promise<void> {
    this.logger.log(`Processing rebalance for cycle ${cycle.id}`);

    // 재조정 로직 (시뮬레이션)
    await this.simulateRebalance(cycle);

    // 사이클 상태를 COMPLETED로 업데이트
    await this.arbitrageRecordService.updateArbitrageCycle(cycle.id, {
      status: 'COMPLETED',
      endTime: new Date(),
    });

    this.logger.log(`Rebalance completed for cycle ${cycle.id}`);
  }

  /**
   * 재조정을 시뮬레이션합니다.
   */
  private async simulateRebalance(cycle: ArbitrageCycle): Promise<void> {
    this.logger.log(`Simulating rebalance for cycle ${cycle.id}`);

    // 시뮬레이션 지연
    await new Promise((resolve) => setTimeout(resolve, 150));

    this.logger.log(`Rebalance simulation completed for cycle ${cycle.id}`);
  }
}
