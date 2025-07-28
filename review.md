# KimP Monorepo 아키텍처 리뷰 및 잠재적 문제 분석

## 개요

이 문서는 `kimp-core` 라이브러리와 전체 모노레포 구조에 대한 종합적인 아키텍처 리뷰 결과입니다. 각 영역별로 현재 상태를 분석하고 잠재적 문제점을 식별하며, 개선 방안을 제시합니다.

---

## 1. Database Concurrency (데이터베이스 동시성)

### 🔍 현재 상태 분석

**파일**: `packages/kimp-core/src/db/arbitrage-record.service.ts`

#### 문제점:

- **Race Condition 위험**: 현재 `ArbitrageRecordService`에는 동시성 제어 메커니즘이 없음
- **캐시 기반 접근**: 인메모리 캐시는 단일 인스턴스에서만 유효
- **Locking 부재**: 여러 Finalizer 인스턴스가 동일한 `AWAITING_REBALANCE` 사이클을 동시에 처리할 위험

#### 현재 코드의 한계:

```typescript
// 현재 방식 - Race Condition 위험
async updateArbitrageCycle(id: string, data: Partial<ArbitrageCycle>): Promise<ArbitrageCycle> {
  const cycle = await this.arbitrageCycleRepository.findOne({ where: { id } });
  // 여기서 다른 인스턴스가 동일한 레코드를 수정할 수 있음
  Object.assign(cycle, data);
  return await this.arbitrageCycleRepository.save(cycle);
}
```

### 🛠️ 개선 방안

#### 1. Pessimistic Locking 구현

```typescript
// packages/kimp-core/src/db/arbitrage-record.service.ts

async findAndLockNextCycle(): Promise<ArbitrageCycle | null> {
  return await this.arbitrageCycleRepository
    .createQueryBuilder('cycle')
    .setLock('pessimistic_write') // TypeORM의 pessimistic locking
    .where('cycle.status = :status', { status: 'AWAITING_REBALANCE' })
    .orderBy('cycle.startTime', 'ASC')
    .getOne();
}

async updateArbitrageCycleWithLock(
  id: string,
  data: Partial<ArbitrageCycle>
): Promise<ArbitrageCycle> {
  return await this.arbitrageCycleRepository.manager.transaction(
    async (transactionalEntityManager) => {
      // Lock을 획득하면서 조회
      const cycle = await transactionalEntityManager
        .createQueryBuilder(ArbitrageCycle, 'cycle')
        .setLock('pessimistic_write')
        .where('cycle.id = :id', { id })
        .getOne();

      if (!cycle) {
        throw new Error(`Arbitrage cycle with ID ${id} not found.`);
      }

      // 상태 변경 검증
      if (data.status && !this.isValidStatusTransition(cycle.status, data.status)) {
        throw new Error(`Invalid status transition: ${cycle.status} → ${data.status}`);
      }

      Object.assign(cycle, data);
      return await transactionalEntityManager.save(cycle);
    }
  );
}

private isValidStatusTransition(from: ArbitrageCycleStatus, to: ArbitrageCycleStatus): boolean {
  const validTransitions = {
    'STARTED': ['INITIAL_TRADE_COMPLETED', 'FAILED'],
    'INITIAL_TRADE_COMPLETED': ['REBALANCE_TRADE_COMPLETED', 'FAILED'],
    'REBALANCE_TRADE_COMPLETED': ['COMPLETED', 'FAILED'],
    'COMPLETED': [],
    'FAILED': []
  };

  return validTransitions[from]?.includes(to) || false;
}
```

#### 2. Optimistic Locking 구현

```typescript
// arbitrage-cycle.entity.ts에 version 컬럼 추가
@Column({ type: 'int', default: 1 })
version: number;

// 서비스에서 optimistic locking 사용
async updateArbitrageCycleOptimistic(
  id: string,
  data: Partial<ArbitrageCycle>,
  expectedVersion: number
): Promise<ArbitrageCycle> {
  const result = await this.arbitrageCycleRepository
    .createQueryBuilder()
    .update(ArbitrageCycle)
    .set({ ...data, version: expectedVersion + 1 })
    .where('id = :id AND version = :version', { id, version: expectedVersion })
    .execute();

  if (result.affected === 0) {
    throw new Error('Concurrent modification detected. Please retry.');
  }

  return await this.getArbitrageCycle(id);
}
```

### 📋 권장사항

1. **Pessimistic Locking 사용**: Finalizer에서 사이클을 처리할 때
2. **Optimistic Locking 사용**: 일반적인 업데이트에서
3. **상태 전이 검증**: 유효한 상태 변경만 허용
4. **재시도 로직**: Lock 획득 실패 시 지수 백오프로 재시도

---

## 2. Configuration & Environment Variables (설정 및 환경 변수)

### 🔍 현재 상태 분석

**파일**: `packages/kimp-core/src/config/investment-config.service.ts`

#### 문제점:

- **단일 .env 파일**: 모든 앱이 루트 `.env` 파일을 공유
- **환경별 설정 부재**: 개발/테스트/프로덕션 환경 구분 없음
- **보안 위험**: 모든 설정이 하나의 파일에 집중

### 🛠️ 개선 방안

#### 1. 환경별 설정 파일 구조

```
kim-p-monorepo/
├── .env                    # 공통 설정 (기본값)
├── .env.development       # 개발 환경
├── .env.test             # 테스트 환경
├── .env.production       # 프로덕션 환경
├── apps/
│   ├── kim-p-initiator/
│   │   ├── .env.local    # 앱별 로컬 설정
│   │   └── .env.test     # 앱별 테스트 설정
│   ├── kim-p-finalizer/
│   │   ├── .env.local
│   │   └── .env.test
│   └── kim-p-feeder/
│       ├── .env.local
│       └── .env.test
```

#### 2. ConfigModule 설정 개선

```typescript
// packages/kimp-core/src/config/config.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`),
        join(process.cwd(), '.env'),
      ],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        DATABASE_URL: Joi.string().required(),
        UPBIT_ACCESS_KEY: Joi.string().when('NODE_ENV', {
          is: 'production',
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
        // ... 기타 설정 검증
      }),
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
```

#### 3. 앱별 설정 관리

```typescript
// apps/kim-p-initiator/src/main.ts

async function bootstrap() {
  const app = await NestFactory.create(KimPInitiatorModule);

  // 앱별 환경 변수 로드
  const configService = app.get(ConfigService);
  const port = configService.get('INITIATOR_PORT', 3001);

  await app.listen(port);
}
```

### 📋 권장사항

1. **환경별 파일 분리**: `.env.development`, `.env.test`, `.env.production`
2. **앱별 설정**: 각 앱의 고유 설정은 앱 디렉토리에 배치
3. **설정 검증**: Joi를 사용한 런타임 설정 검증
4. **보안 강화**: 민감한 정보는 환경 변수나 시크릿 관리 시스템 사용

---

## 3. Distributed Error Handling & State Consistency (분산 에러 처리 및 상태 일관성)

### 🔍 현재 상태 분석

**파일**:

- `packages/kimp-core/src/db/entities/arbitrage-cycle.entity.ts`
- `packages/kimp-core/src/utils/handler/error-handler.service.ts`

#### 문제점:

- **재시도 메커니즘 부재**: 실패한 사이클에 대한 재시도 로직 없음
- **Dead Letter Queue 부재**: 영구 실패한 사이클 처리 방법 없음
- **상태 복구 불가**: `REBALANCING_IN_PROGRESS` 상태에서 벗어날 방법 없음

### 🛠️ 개선 방안

#### 1. ArbitrageCycle 엔티티 개선

```typescript
// packages/kimp-core/src/db/entities/arbitrage-cycle.entity.ts

export type ArbitrageCycleStatus =
  | 'STARTED'
  | 'INITIAL_TRADE_COMPLETED'
  | 'REBALANCE_TRADE_COMPLETED'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRY_PENDING' // 재시도 대기
  | 'DEAD_LETTER'; // 영구 실패

@Entity('arbitrage_cycles')
export class ArbitrageCycle {
  // ... 기존 필드들

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  @Column({ type: 'timestamp', nullable: true })
  lastRetryAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ type: 'json', nullable: true })
  retryHistory: Array<{
    attempt: number;
    timestamp: Date;
    error: string;
    context: any;
  }>;
}
```

#### 2. Dead Letter Queue 구현

```typescript
// packages/kimp-core/src/utils/service/dead-letter-queue.service.ts

@Injectable()
export class DeadLetterQueueService {
  private readonly logger = new Logger(DeadLetterQueueService.name);

  constructor(
    private readonly arbitrageRecordService: ArbitrageRecordService,
    private readonly telegramService: TelegramService,
  ) {}

  async processDeadLetterCycles(): Promise<void> {
    const deadLetterCycles = await this.arbitrageRecordService
      .createQueryBuilder('cycle')
      .where('cycle.status = :status', { status: 'DEAD_LETTER' })
      .getMany();

    for (const cycle of deadLetterCycles) {
      await this.handleDeadLetterCycle(cycle);
    }
  }

  private async handleDeadLetterCycle(cycle: ArbitrageCycle): Promise<void> {
    // 1. 관리자에게 알림
    await this.telegramService.sendMessage(
      `🚨 Dead Letter Cycle Detected\n` +
        `Cycle ID: ${cycle.id}\n` +
        `Failure Reason: ${cycle.failureReason}\n` +
        `Retry Count: ${cycle.retryCount}/${cycle.maxRetries}`,
    );

    // 2. 수동 개입을 위한 로그
    this.logger.error(
      `Dead letter cycle requires manual intervention: ${cycle.id}`,
    );

    // 3. 필요시 자동 복구 시도 (예: 부분 환불)
    await this.attemptRecovery(cycle);
  }

  private async attemptRecovery(cycle: ArbitrageCycle): Promise<void> {
    // 복구 로직 구현
    // 예: 부분 환불, 포지션 정리 등
  }
}
```

#### 3. 재시도 메커니즘 구현

```typescript
// packages/kimp-core/src/utils/service/retry-manager.service.ts

@Injectable()
export class RetryManagerService {
  private readonly logger = new Logger(RetryManagerService.name);

  async scheduleRetry(
    cycleId: string,
    delayMinutes: number = 5,
  ): Promise<void> {
    const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    await this.arbitrageRecordService.updateArbitrageCycle(cycleId, {
      status: 'RETRY_PENDING',
      nextRetryAt,
      retryCount: () => `retry_count + 1`,
    });

    this.logger.log(`Retry scheduled for cycle ${cycleId} at ${nextRetryAt}`);
  }

  async processRetryPendingCycles(): Promise<void> {
    const retryPendingCycles = await this.arbitrageRecordService
      .createQueryBuilder('cycle')
      .where('cycle.status = :status', { status: 'RETRY_PENDING' })
      .andWhere('cycle.nextRetryAt <= :now', { now: new Date() })
      .getMany();

    for (const cycle of retryPendingCycles) {
      await this.processRetry(cycle);
    }
  }

  private async processRetry(cycle: ArbitrageCycle): Promise<void> {
    if (cycle.retryCount >= cycle.maxRetries) {
      await this.moveToDeadLetter(cycle);
      return;
    }

    try {
      // 재시도 로직 실행
      await this.executeRetryLogic(cycle);
    } catch (error) {
      await this.handleRetryFailure(cycle, error);
    }
  }
}
```

### 📋 권장사항

1. **재시도 카운터 추가**: `retryCount`, `maxRetries` 필드
2. **Dead Letter Queue 구현**: 영구 실패한 사이클 처리
3. **지수 백오프**: 재시도 간격을 점진적으로 증가
4. **수동 개입 알림**: 관리자에게 Dead Letter 알림

---

## 4. Centralized Logging and Tracing (중앙화된 로깅 및 추적)

### 🔍 현재 상태 분석

**파일**: `packages/kimp-core/src/utils/handler/logging.service.ts`

#### 현재 장점:

- **구조화된 로깅**: LogContext 인터페이스로 일관된 형식
- **cycleId 지원**: 이미 cycleId 필드가 있음

#### 문제점:

- **Correlation ID 부재**: cycleId가 자동으로 모든 로그에 포함되지 않음
- **분산 추적 부재**: 여러 앱 간 로그 연결 어려움
- **로그 컨텍스트 전파**: 요청별 컨텍스트가 자동으로 전파되지 않음

### 🛠️ 개선 방안

#### 1. Correlation ID 자동 주입

```typescript
// packages/kimp-core/src/utils/handler/logging.service.ts

import { Injectable, Logger, Scope } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface LoggingContext {
  cycleId?: string;
  sessionId?: string;
  requestId?: string;
  userId?: string;
}

@Injectable({ scope: Scope.TRANSIENT })
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);
  private static asyncLocalStorage = new AsyncLocalStorage<LoggingContext>();

  static setContext(context: LoggingContext): void {
    this.asyncLocalStorage.enterWith(context);
  }

  static getContext(): LoggingContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
    data?: any,
  ): string {
    const parts: string[] = [];
    const globalContext = LoggingService.getContext();

    // 로그 레벨
    parts.push(`[${level}]`);

    // Correlation ID (자동 주입)
    if (globalContext?.requestId) {
      parts.push(`[REQ:${globalContext.requestId}]`);
    }
    if (globalContext?.cycleId) {
      parts.push(`[CYCLE:${globalContext.cycleId}]`);
    }
    if (globalContext?.sessionId) {
      parts.push(`[SESSION:${globalContext.sessionId}]`);
    }

    // 추가 컨텍스트 정보
    if (context) {
      if (context.service) parts.push(`[${context.service}]`);
      if (context.method) parts.push(`[${context.method}]`);
      if (context.symbol) parts.push(`[${context.symbol.toUpperCase()}]`);
    }

    // 메시지
    parts.push(message);

    // 데이터 (있는 경우)
    if (data) {
      parts.push(`| Data: ${JSON.stringify(data)}`);
    }

    return parts.join(' ');
  }

  // cycleId를 자동으로 포함하는 편의 메서드들
  cycleLog(
    level: LogLevel,
    message: string,
    cycleId: string,
    data?: any,
  ): void {
    LoggingService.setContext({ cycleId });
    this[level.toLowerCase()](message, undefined, data);
  }

  cycleInfo(message: string, cycleId: string, data?: any): void {
    this.cycleLog(LogLevel.INFO, message, cycleId, data);
  }

  cycleError(
    message: string,
    cycleId: string,
    error?: Error,
    data?: any,
  ): void {
    LoggingService.setContext({ cycleId });
    this.error(message, error, undefined, data);
  }
}
```

#### 2. HTTP 요청 인터셉터

```typescript
// packages/kimp-core/src/utils/interceptors/logging.interceptor.ts

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggingService } from '../handler/logging.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly loggingService: LoggingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId =
      request.headers['x-request-id'] || this.generateRequestId();
    const cycleId = request.headers['x-cycle-id'] || request.body?.cycleId;

    // 컨텍스트 설정
    LoggingService.setContext({
      requestId,
      cycleId,
      sessionId: request.headers['x-session-id'],
    });

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          this.loggingService.info(`Request completed in ${duration}ms`, {
            method: request.method,
            url: request.url,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.loggingService.error(`Request failed in ${duration}ms`, error, {
            method: request.method,
            url: request.url,
          });
        },
      }),
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### 3. 서비스에서 사용 예시

```typescript
// apps/kim-p-finalizer/src/finalizer.service.ts

@Injectable()
export class FinalizerService {
  constructor(
    private readonly loggingService: LoggingService,
    private readonly arbitrageRecordService: ArbitrageRecordService,
  ) {}

  async processCycle(cycleId: string): Promise<void> {
    // cycleId가 자동으로 모든 로그에 포함됨
    this.loggingService.cycleInfo('Starting cycle processing', cycleId);

    try {
      const cycle =
        await this.arbitrageRecordService.getArbitrageCycle(cycleId);
      this.loggingService.cycleInfo('Cycle retrieved successfully', cycleId, {
        status: cycle.status,
      });

      // 처리 로직...

      this.loggingService.cycleInfo('Cycle processing completed', cycleId);
    } catch (error) {
      this.loggingService.cycleError('Cycle processing failed', cycleId, error);
      throw error;
    }
  }
}
```

### 📋 권장사항

1. **AsyncLocalStorage 사용**: 요청별 컨텍스트 자동 전파
2. **Correlation ID 자동 주입**: cycleId, requestId 자동 포함
3. **HTTP 인터셉터**: 모든 요청에 로깅 컨텍스트 적용
4. **구조화된 로그**: JSON 형식으로 로그 출력 (프로덕션)

---

## 5. Dependency Management (의존성 관리)

### 🔍 현재 상태 분석

**파일**:

- 루트 `package.json`
- `packages/kimp-core/package.json`

#### 문제점:

- **중앙화된 의존성**: 모든 의존성이 루트 package.json에 집중
- **버전 충돌 위험**: 앱별로 다른 버전 요구사항 처리 어려움
- **번들 크기 증가**: 불필요한 의존성이 모든 앱에 포함

### 🛠️ 개선 방안

#### 1. Workspace 의존성 구조 개선

```json
// 루트 package.json
{
  "name": "kim-p-monorepo",
  "workspaces": ["apps/*", "packages/*"],
  "dependencies": {
    // 공통 의존성만 유지
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    // 개발 도구만 유지
    "@nestjs/cli": "^10.0.0",
    "typescript": "^5.1.3",
    "jest": "^29.5.0"
  }
}
```

```json
// packages/kimp-core/package.json
{
  "name": "@kim-p-monorepo/kimp-core",
  "dependencies": {
    // kimp-core 전용 의존성
    "@nestjs/typeorm": "^10.0.1",
    "@nestjs/config": "^3.1.1",
    "typeorm": "^0.3.17",
    "axios": "^1.6.0",
    "jsonwebtoken": "^9.0.2",
    "uuid": "^9.0.1"
  },
  "peerDependencies": {
    // 호스트 앱에서 제공해야 하는 의존성
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0"
  }
}
```

```json
// apps/kim-p-initiator/package.json
{
  "name": "@kim-p-monorepo/kim-p-initiator",
  "dependencies": {
    "@kim-p-monorepo/kimp-core": "workspace:*",
    "@nestjs/schedule": "^4.0.0"
  },
  "peerDependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0"
  }
}
```

#### 2. 의존성 분리 전략

```typescript
// packages/kimp-core/src/exchange/exchange.interface.ts
// 외부 의존성 없이 인터페이스만 정의

export interface IExchange {
  // 메서드 시그니처만 정의
  getBalances(): Promise<Balance[]>;
  createOrder(/* ... */): Promise<Order>;
  // ...
}
```

```typescript
// packages/kimp-core/src/exchange/upbit/upbit.service.ts
// 실제 구현은 호스트 앱에서 제공

@Injectable()
export class UpbitService implements IExchange {
  // axios, jsonwebtoken 등은 호스트 앱에서 주입받음
  constructor(
    private readonly httpService: HttpService, // 호스트 앱에서 제공
    private readonly jwtService: JwtService, // 호스트 앱에서 제공
  ) {}
}
```

#### 3. 번들 최적화

```typescript
// packages/kimp-core/src/index.ts
// 선택적 export로 번들 크기 최적화

// 기본 export
export * from './kimp-core.module';
export * from './kimp-core.service';

// 선택적 export (필요한 것만 import)
export { DatabaseModule } from './db/database.module';
export { ExchangeModule } from './exchange/exchange.module';
export { UtilsModule } from './utils/utils.module';

// 타입만 필요한 경우
export type { ArbitrageCycle } from './db/entities/arbitrage-cycle.entity';
export type { IExchange } from './exchange/exchange.interface';
```

### 📋 권장사항

1. **Workspace 의존성 사용**: `workspace:*` 표기법으로 로컬 패키지 참조
2. **Peer Dependencies**: 공통 의존성은 peerDependencies로 관리
3. **선택적 Import**: 필요한 모듈만 import하여 번들 크기 최적화
4. **의존성 분리**: 인터페이스와 구현 분리

---

## 종합 권장사항

### 🚀 우선순위별 개선 계획

#### Phase 1 (즉시 적용)

1. **Database Concurrency**: Pessimistic Locking 구현
2. **Environment Variables**: 환경별 설정 파일 분리
3. **Logging**: Correlation ID 자동 주입

#### Phase 2 (단기)

1. **Error Handling**: Dead Letter Queue 구현
2. **Retry Mechanism**: 재시도 로직 추가
3. **Dependency Management**: Workspace 의존성 구조 개선

#### Phase 3 (중기)

1. **Monitoring**: 분산 추적 시스템 도입
2. **Testing**: 통합 테스트 환경 구축
3. **CI/CD**: 자동화된 배포 파이프라인

### 📊 아키텍처 점수

| 영역                     | 현재 점수 | 목표 점수 | 개선 필요도 |
| ------------------------ | --------- | --------- | ----------- |
| Database Concurrency     | 3/10      | 9/10      | 🔴 높음     |
| Configuration Management | 4/10      | 9/10      | 🔴 높음     |
| Error Handling           | 5/10      | 8/10      | 🟡 중간     |
| Logging & Tracing        | 6/10      | 9/10      | 🟡 중간     |
| Dependency Management    | 4/10      | 8/10      | 🟡 중간     |

**전체 점수**: 4.4/10 → 목표: 8.6/10

### 🎯 결론

현재 `kimp-core` 라이브러리는 기본적인 기능은 잘 구현되어 있지만, 프로덕션 환경에서의 안정성과 확장성을 위해 상당한 개선이 필요합니다. 특히 데이터베이스 동시성 제어와 환경 설정 관리가 가장 시급한 개선 사항입니다.

이러한 개선사항들을 단계적으로 적용하면 안정적이고 확장 가능한 분산 시스템을 구축할 수 있을 것입니다.
