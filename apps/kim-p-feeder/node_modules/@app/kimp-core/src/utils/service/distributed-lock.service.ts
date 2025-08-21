import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);
  private redis: Redis;

  constructor() {
    // Redis 연결 설정
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis 연결 오류: ${error.message}`);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis 연결 성공');
    });
  }

  /**
   * 분산 잠금을 획득합니다
   * @param key 잠금 키
   * @param ttl 잠금 유지 시간 (밀리초)
   * @returns 잠금 획득 성공 여부
   */
  async acquireLock(key: string, ttl: number): Promise<boolean> {
    try {
      // NX: 키가 존재하지 않을 때만 설정
      // PX: 만료 시간을 밀리초 단위로 설정
      const result = await this.redis.set(key, 'locked', 'PX', ttl, 'NX');

      if (result === 'OK') {
        this.logger.debug(`잠금 획득 성공: ${key} (TTL: ${ttl}ms)`);
        return true;
      } else {
        this.logger.debug(`잠금 획득 실패: ${key} (이미 잠겨있음)`);
        return false;
      }
    } catch (error) {
      this.logger.error(`잠금 획득 중 오류: ${error.message}`);
      return false;
    }
  }

  /**
   * 분산 잠금을 해제합니다
   * @param key 잠금 키
   */
  async releaseLock(key: string): Promise<void> {
    try {
      const result = await this.redis.del(key);
      if (result === 1) {
        this.logger.debug(`잠금 해제 성공: ${key}`);
      } else {
        this.logger.debug(`잠금 해제 실패: ${key} (이미 해제됨)`);
      }
    } catch (error) {
      this.logger.error(`잠금 해제 중 오류: ${error.message}`);
    }
  }

  /**
   * 잠금 상태를 확인합니다
   * @param key 잠금 키
   * @returns 잠금 상태
   */
  async isLocked(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`잠금 상태 확인 중 오류: ${error.message}`);
      return false;
    }
  }

  /**
   * 잠금의 남은 TTL을 확인합니다
   * @param key 잠금 키
   * @returns 남은 TTL (밀리초), -1은 키가 존재하지 않음을 의미
   */
  async getLockTTL(key: string): Promise<number> {
    try {
      const ttl = await this.redis.pttl(key);
      return ttl;
    } catch (error) {
      this.logger.error(`잠금 TTL 확인 중 오류: ${error.message}`);
      return -1;
    }
  }

  /**
   * Redis 연결을 종료합니다
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      this.logger.log('Redis 연결 종료');
    } catch (error) {
      this.logger.error(`Redis 연결 종료 중 오류: ${error.message}`);
    }
  }
}
