// packages/kimp-core/src/db/arbitrage-record.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArbitrageCycle } from './entities/arbitrage-cycle.entity';
import { Trade } from './entities/trade.entity';

@Injectable()
export class ArbitrageRecordService {
  private readonly logger = new Logger(ArbitrageRecordService.name);

  // 캐시 추가
  private cycleCache = new Map<string, ArbitrageCycle>();
  private readonly CACHE_DURATION = 10000; // 10초 캐시
  private cacheTimestamps = new Map<string, number>();

  constructor(
    @InjectRepository(ArbitrageCycle)
    private readonly arbitrageCycleRepository: Repository<ArbitrageCycle>,
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
  ) {}

  async createArbitrageCycle(
    data: Partial<ArbitrageCycle>,
  ): Promise<ArbitrageCycle> {
    const newCycle = this.arbitrageCycleRepository.create(data);
    newCycle.status = 'STARTED'; // 초기 상태
    const savedCycle = await this.arbitrageCycleRepository.save(newCycle);

    // 캐시에 추가
    this.cycleCache.set(savedCycle.id, savedCycle);
    this.cacheTimestamps.set(savedCycle.id, Date.now());

    this.logger.log(`새로운 차익거래 사이클 시작: ${savedCycle.id}`);
    return savedCycle;
  }

  async updateArbitrageCycle(
    id: string,
    data: Partial<ArbitrageCycle>,
  ): Promise<ArbitrageCycle> {
    const sanitizedData = this.sanitizeData(data);

    // 캐시에서 먼저 확인
    const cachedCycle = this.getCachedCycle(id);
    if (cachedCycle) {
      Object.assign(cachedCycle, sanitizedData);
      const updatedCycle =
        await this.arbitrageCycleRepository.save(cachedCycle);

      // 캐시 업데이트
      this.cycleCache.set(id, updatedCycle);
      this.cacheTimestamps.set(id, Date.now());

      this.logger.log(
        `차익거래 사이클 업데이트 (캐시): ${updatedCycle.id}, 상태: ${updatedCycle.status}`,
      );
      return updatedCycle;
    }

    const cycle = await this.arbitrageCycleRepository.findOne({
      where: { id },
    });
    if (!cycle) {
      this.logger.error(`ID ${id}를 가진 차익거래 사이클을 찾을 수 없습니다.`);
      throw new Error(`Arbitrage cycle with ID ${id} not found.`);
    }
    Object.assign(cycle, data);
    const updatedCycle = await this.arbitrageCycleRepository.save(cycle);

    // 캐시에 저장
    this.cycleCache.set(id, updatedCycle);
    this.cacheTimestamps.set(id, Date.now());

    this.logger.log(
      `차익거래 사이클 업데이트: ${updatedCycle.id}, 상태: ${updatedCycle.status}`,
    );
    return updatedCycle;
  }

  // Infinity 값 검증 및 정리 메서드
  private sanitizeData(data: Partial<ArbitrageCycle>): Partial<ArbitrageCycle> {
    const sanitized = { ...data };

    // 숫자 필드들에 대해 Infinity, -Infinity, NaN 검증
    const numericFields = [
      'totalNetProfitKrw',
      'totalNetProfitPercent',
      'initialInvestmentKrw',
    ];

    numericFields.forEach((field) => {
      if (field in sanitized && typeof sanitized[field] === 'number') {
        const value = sanitized[field] as number;
        if (!isFinite(value)) {
          this.logger.warn(
            `[SANITIZE] Invalid value detected for ${field}: ${value}, setting to 0`,
          );
          sanitized[field] = 0;
        }
      }
    });

    return sanitized;
  }

  async getArbitrageCycle(id: string): Promise<ArbitrageCycle | null> {
    const cachedCycle = this.getCachedCycle(id);
    if (cachedCycle) {
      return cachedCycle;
    }

    // DB에서 조회
    const cycle = await this.arbitrageCycleRepository.findOne({
      where: { id },
    });
    if (cycle) {
      // 캐시에 저장
      this.cycleCache.set(id, cycle);
      this.cacheTimestamps.set(id, Date.now());
    }
    return cycle;
  }

  // 배치 업데이트 메서드 추가
  async batchUpdateArbitrageCycles(
    updates: Array<{ id: string; data: Partial<ArbitrageCycle> }>,
  ): Promise<ArbitrageCycle[]> {
    const results: ArbitrageCycle[] = [];

    for (const update of updates) {
      try {
        const result = await this.updateArbitrageCycle(update.id, update.data);
        results.push(result);
      } catch (error) {
        this.logger.error(
          `배치 업데이트 실패 (ID: ${update.id}): ${error.message}`,
        );
        throw error;
      }
    }

    this.logger.log(`배치 업데이트 완료: ${results.length}개 사이클`);
    return results;
  }

  // 캐시 관리 메서드들
  private getCachedCycle(id: string): ArbitrageCycle | null {
    const cached = this.cycleCache.get(id);
    const timestamp = this.cacheTimestamps.get(id);

    if (cached && timestamp && Date.now() - timestamp < this.CACHE_DURATION) {
      return cached;
    }

    // 캐시 만료 시 제거
    if (cached) {
      this.cycleCache.delete(id);
      this.cacheTimestamps.delete(id);
    }

    return null;
  }
  // 캐시 무효화
  invalidateCache(id?: string): void {
    if (id) {
      this.cycleCache.delete(id);
      this.cacheTimestamps.delete(id);
    } else {
      this.cycleCache.clear();
      this.cacheTimestamps.clear();
    }
  }

  // 캐시 통계
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cycleCache.size,
      hitRate: 0, // TODO: 히트율 계산 로직 추가
    };
  }

  // Trade 관련 메서드들
  async createTrade(data: Partial<Trade>): Promise<Trade> {
    const newTrade = this.tradeRepository.create(data);
    const savedTrade = await this.tradeRepository.save(newTrade);
    this.logger.log(
      `새로운 거래 생성: ${savedTrade.id}, 타입: ${savedTrade.tradeType}`,
    );
    return savedTrade;
  }

  async updateTrade(id: string, data: Partial<Trade>): Promise<Trade> {
    const trade = await this.tradeRepository.findOne({ where: { id } });
    if (!trade) {
      this.logger.error(`ID ${id}를 가진 거래를 찾을 수 없습니다.`);
      throw new Error(`Trade with ID ${id} not found.`);
    }
    Object.assign(trade, data);
    const updatedTrade = await this.tradeRepository.save(trade);
    this.logger.log(
      `거래 업데이트: ${updatedTrade.id}, 상태: ${updatedTrade.status}`,
    );
    return updatedTrade;
  }

  async getTrade(id: string): Promise<Trade | null> {
    return await this.tradeRepository.findOne({ where: { id } });
  }

  async getTradesByCycleId(cycleId: string): Promise<Trade[]> {
    return await this.tradeRepository.find({ where: { cycleId } });
  }

  async getCycleWithTrades(id: string): Promise<ArbitrageCycle | null> {
    return await this.arbitrageCycleRepository.findOne({
      where: { id },
      relations: ['trades'],
    });
  }

  /**
   * 다음 대기 중인 사이클을 찾아서 즉시 잠금 처리합니다.
   * 여러 Finalizer 인스턴스 간의 Race Condition을 방지합니다.
   */
  public async findAndLockNextCycle(): Promise<ArbitrageCycle | null> {
    return this.arbitrageCycleRepository.manager.transaction(
      async (transactionalEntityManager) => {
        // 1. 가장 오래된 대기 중인 사이클을 찾고 쓰기 잠금을 설정
        const cycle = await transactionalEntityManager
          .createQueryBuilder(ArbitrageCycle, 'cycle')
          .setLock('pessimistic_write')
          .where('cycle.status = :status', { status: 'AWAITING_REBALANCE' })
          .orderBy('cycle.startTime', 'ASC')
          .getOne();

        // 2. 사이클을 찾지 못한 경우 null 반환
        if (!cycle) {
          this.logger.debug('No pending cycles found for rebalancing');
          return null;
        }

        // 3. 즉시 상태를 REBALANCING_IN_PROGRESS로 업데이트하여 논리적으로 잠금
        cycle.status = 'REBALANCING_IN_PROGRESS';
        await transactionalEntityManager.save(cycle);

        this.logger.log(
          `Locked and updated cycle ${cycle.id} to REBALANCING_IN_PROGRESS`,
        );

        // 4. 잠긴 사이클 반환
        return cycle;
      },
    );
  }
}
