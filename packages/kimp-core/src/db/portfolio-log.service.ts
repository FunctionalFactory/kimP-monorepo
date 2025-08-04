// packages/kimp-core/src/db/portfolio-log.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortfolioLog } from './entities/portfolio-log.entity';

@Injectable()
export class PortfolioLogService {
  private readonly logger = new Logger(PortfolioLogService.name);
  private latestPortfolioCache: PortfolioLog | null = null;
  private lastCacheUpdate = 0;
  private readonly CACHE_DURATION = 5000; // 5초 캐시

  constructor(
    @InjectRepository(PortfolioLog)
    private readonly portfolioLogRepository: Repository<PortfolioLog>,
  ) {}

  // WsService에서 가져온 parseAndValidateNumber 함수 또는 유사한 기능
  private parseToNumber(value: any): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const num = Number(value); // 또는 parseFloat(value)
    return isNaN(num) ? null : num;
  }

  async createLog(data: {
    total_balance_krw: number;
    cycle_pnl_krw?: number;
    total_pnl_krw?: number;
    roi_percentage?: number;
    log_type: 'INITIAL' | 'TRADE' | 'FINAL';
    cycle_id?: number | null;
  }): Promise<PortfolioLog> {
    try {
      const newLogData: Partial<PortfolioLog> = {
        total_balance_krw: data.total_balance_krw,
        cycle_pnl_krw: data.cycle_pnl_krw || 0,
        total_pnl_krw: data.total_pnl_krw || 0,
        roi_percentage: data.roi_percentage || 0,
        log_type: data.log_type,
        cycle_id: data.cycle_id || null,
      };

      const newLog = this.portfolioLogRepository.create(newLogData);
      const savedLog = await this.portfolioLogRepository.save(newLog);

      const totalBalanceForLog = this.parseToNumber(savedLog.total_balance_krw);
      const cyclePnlForLog = this.parseToNumber(savedLog.cycle_pnl_krw);

      this.logger.log(
        `새 포트폴리오 로그 생성됨: ID ${savedLog.id}, 총 잔고 ${totalBalanceForLog !== null ? totalBalanceForLog.toFixed(0) : 'N/A'} KRW, 직전 사이클 PNL: ${cyclePnlForLog !== null ? cyclePnlForLog.toFixed(0) : 'N/A'} KRW`,
      );

      // 캐시 무효화
      this.invalidateCache();

      return savedLog;
    } catch (error) {
      this.logger.error(
        `포트폴리오 로그 생성 실패: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  async getLatestPortfolio(): Promise<PortfolioLog | null> {
    try {
      const now = Date.now();
      if (
        this.latestPortfolioCache &&
        now - this.lastCacheUpdate < this.CACHE_DURATION
      ) {
        return this.latestPortfolioCache;
      }
      const logs = await this.portfolioLogRepository.find({
        order: { createdAt: 'DESC' },
        take: 1,
      });

      const latestLog = logs.length > 0 ? logs[0] : null;

      if (latestLog) {
        // 🌶️ 로깅 전 숫자 변환
        const totalBalanceForLog = this.parseToNumber(
          latestLog.total_balance_krw,
        );

        // this.logger.verbose(
        //   `가장 최근 포트폴리오 로그 조회됨: ID ${latestLog.id}, 총 잔고 ${totalBalanceForLog !== null ? totalBalanceForLog.toFixed(0) : 'N/A'} KRW (CreatedAt: ${latestLog.createdAt.toISOString()})`,
        // );

        // 캐시 업데이트
        this.latestPortfolioCache = latestLog;
        this.lastCacheUpdate = now;
      } else {
        this.logger.warn(
          '조회된 포트폴리오 로그가 없습니다. 초기 자본 설정이 필요할 수 있습니다.',
        );
      }
      return latestLog;
    } catch (error) {
      this.logger.error(
        `최근 포트폴리오 로그 조회 실패: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
  // 캐시 무효화 메서드 (외부에서 필요시 호출)
  invalidateCache(): void {
    this.latestPortfolioCache = null;
    this.lastCacheUpdate = 0;
  }
}
