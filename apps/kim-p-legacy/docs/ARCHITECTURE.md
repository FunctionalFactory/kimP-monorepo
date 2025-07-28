# kimP 아키텍처 문서 (Architecture Documentation)

## 개요 (Overview)

kimP는 암호화폐 차익거래를 자동화하는 고성능 시스템입니다. 이 문서는 시스템의 전체 아키텍처, 설계 원칙, 그리고 주요 컴포넌트들의 상호작용을 설명합니다.

---

## 1. 시스템 아키텍처 개요 (System Architecture Overview)

### 1.1. 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    kimP System Architecture                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Client    │  │   Client    │  │   Client    │         │
│  │ (Telegram)  │  │ (Web UI)    │  │ (API)       │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Presentation Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │Monitoring   │  │Notification │  │Webhook      │         │
│  │Module       │  │Module       │  │Controller   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Business Logic Layer                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │Arbitrage    │  │Session      │  │Common       │         │
│  │Module       │  │Module       │  │Module       │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Data Access Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │Upbit        │  │Binance      │  │Database     │         │
│  │Module       │  │Module       │  │(TypeORM)    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │WebSocket    │  │Config       │  │Logging      │         │
│  │Service      │  │Service      │  │Service      │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 1.2. 계층별 역할

#### **Presentation Layer (표현 계층)**

- **역할**: 외부 시스템과의 인터페이스 제공
- **주요 컴포넌트**: Monitoring, Notification, Webhook Controller
- **특징**: REST API, WebSocket, 텔레그램 봇 인터페이스

#### **Business Logic Layer (비즈니스 로직 계층)**

- **역할**: 핵심 차익거래 로직과 세션 관리
- **주요 컴포넌트**: Arbitrage, Session, Common Module
- **특징**: 도메인 로직, 상태 관리, 계산 서비스

#### **Data Access Layer (데이터 접근 계층)**

- **역할**: 외부 데이터 소스와의 통신
- **주요 컴포넌트**: Upbit, Binance Module, Database
- **특징**: API 통신, 데이터 영속성

#### **Infrastructure Layer (인프라 계층)**

- **역할**: 시스템 인프라 지원
- **주요 컴포넌트**: WebSocket, Config, Logging Service
- **특징**: 설정 관리, 로깅, 실시간 통신

---

## 2. 핵심 설계 원칙 (Core Design Principles)

### 2.1. 모듈화 및 관심사 분리 (Modularity and Separation of Concerns)

각 모듈은 명확한 책임을 가지며, 다른 모듈과의 결합도를 최소화합니다.

```typescript
// 예시: CommonModule을 통한 공통 서비스 중앙화
@Module({
  imports: [AppConfigModule, UpbitModule, BinanceModule],
  providers: [
    SpreadCalculatorService,
    ExchangeService,
    FeeCalculatorService,
    // ... 기타 공통 서비스들
  ],
  exports: [
    SpreadCalculatorService,
    ExchangeService,
    FeeCalculatorService,
    // ... 기타 공통 서비스들
  ],
})
export class CommonModule {}
```

### 2.2. 의존성 주입 (Dependency Injection)

NestJS의 DI 컨테이너를 활용하여 컴포넌트 간의 결합도를 낮춥니다.

```typescript
// 예시: InvestmentConfigService 주입
@Injectable()
export class PortfolioManagerService {
  constructor(
    private readonly portfolioLogService: PortfolioLogService,
    private readonly investmentConfigService: InvestmentConfigService,
  ) {}
}
```

### 2.3. 인터페이스 기반 설계 (Interface-Based Design)

확장성과 테스트 용이성을 위해 인터페이스를 활용합니다.

```typescript
// 예시: IExchange 인터페이스
export interface IExchange {
  createOrder(
    symbol: string,
    side: string,
    quantity: number,
    price?: number,
  ): Promise<any>;
  getBalance(asset: string): Promise<number>;
  withdraw(asset: string, amount: number, address: string): Promise<any>;
}
```

### 2.4. 상태 관리 중앙화 (Centralized State Management)

시스템의 상태를 중앙에서 관리하여 일관성을 보장합니다.

```typescript
// 예시: ArbitrageCycleStateService
@Injectable()
export class ArbitrageCycleStateService {
  private currentState: CycleExecutionStatus = CycleExecutionStatus.IDLE;

  setState(newState: CycleExecutionStatus): void {
    this.currentState = newState;
  }

  getState(): CycleExecutionStatus {
    return this.currentState;
  }
}
```

---

## 3. 모듈 아키텍처 (Module Architecture)

### 3.1. 모듈 의존성 다이어그램

```
AppModule
├── ConfigModule
├── MarketDataModule
├── ArbitrageModule
│   ├── CommonModule
│   ├── NotificationModule
│   └── SessionModule
├── SessionModule
│   ├── CommonModule
│   └── ArbitrageModule (forwardRef)
├── NotificationModule
│   └── CommonModule
├── MonitoringModule
│   └── CommonModule
├── UpbitModule
├── BinanceModule
└── DatabaseModule
```

### 3.2. 주요 모듈 설명

#### **AppModule (루트 모듈)**

- **역할**: 전체 애플리케이션의 진입점
- **주요 기능**: 모듈 통합, 전역 설정
- **의존성**: 모든 기능 모듈

#### **ArbitrageModule (차익거래 핵심 모듈)**

- **역할**: 차익거래 로직의 총괄 관리
- **주요 서비스**: ArbitrageFlowManagerService, HighPremiumProcessorService, LowPremiumProcessorService
- **특징**: 다단계 필터링, 상태 관리

#### **SessionModule (세션 관리 모듈)**

- **역할**: 세션 기반 병렬 처리 시스템
- **주요 서비스**: SessionManagerService, SessionExecutorService, SessionStateService
- **특징**: 세션 독립성, 우선순위 관리, Reverse 모드 지원

#### **CommonModule (공통 서비스 모듈)**

- **역할**: 모든 모듈에서 공통으로 사용되는 서비스 제공
- **주요 서비스**: ExchangeService, FeeCalculatorService, PortfolioManagerService
- **특징**: 중앙화된 서비스 관리

---

## 4. 데이터 흐름 (Data Flow)

### 4.1. 실시간 가격 데이터 흐름

```
PriceFeedService (WebSocket)
    ↓
WsService (데이터 중계)
    ↓
ArbitrageFlowManagerService (기회 분석)
    ↓
SessionManagerService (세션 생성)
    ↓
SessionExecutorService (세션 실행)
    ↓
HighPremiumProcessorService / LowPremiumProcessorService
    ↓
StrategyHighService / StrategyLowService (거래 실행)
    ↓
ExchangeService (API 호출)
    ↓
UpbitService / BinanceService (실제 거래소 통신)
```

### 4.2. 세션 기반 병렬 처리 흐름

```
SessionManagerService
    ↓ (기회 발견)
SessionStateService.createSession()
    ↓
SessionFundValidationService.validateSessionFunds()
    ↓
SessionExecutorService.executeSessions()
    ↓
ArbitrageFlowManagerService.handlePriceUpdate()
    ↓
HighPremiumProcessorService.processHighPremiumOpportunity()
    ↓
StrategyHighService.executeHighPremiumStrategy()
    ↓
ExchangeService.createOrder()
    ↓
CycleCompletionService.completeCycle()
```

### 4.3. Reverse 모드 데이터 흐름

```
SessionManagerService (Reverse 모드 감지)
    ↓
SessionExecutorService.executeLowPremiumStep() (1단계)
    ↓
StrategyLowService.handleLowPremiumFlow()
    ↓
업비트 매수 → 바이낸스 출금 → 바이낸스 현물 매도 → 선물 숏 포지션
    ↓
SessionStateService.updateSessionStatus(AWAITING_SECOND_STEP)
    ↓
SessionExecutorService.executeHighPremiumStep() (2단계)
    ↓
StrategyHighService.handleHighPremiumFlow()
    ↓
바이낸스 현물 매수 → 업비트 출금 → 업비트 매도 → 선물 롱 포지션
    ↓
SessionStateService.updateSessionStatus(COMPLETED)
```

### 4.4. 데이터 영속성 흐름

```
비즈니스 로직 실행
    ↓
ArbitrageRecordService.createArbitrageRecord()
    ↓
PortfolioLogService.createPortfolioLog()
    ↓
TypeORM Entity
    ↓
MySQL Database
```

---

## 5. 성능 최적화 아키텍처 (Performance Optimization Architecture)

### 5.1. 캐싱 전략

#### **계층별 캐싱**

```typescript
// 1. 설정 캐싱 (InvestmentConfigService)
private cachedConfig: InvestmentConfig | null = null;
private readonly CONFIG_CACHE_DURATION = 60000; // 1분

// 2. 포트폴리오 캐싱 (PortfolioManagerService)
private portfolioCache: {
  latestLog: PortfolioLog | null;
  investmentAmount: number;
  timestamp: number;
} | null = null;
private readonly CACHE_DURATION = 5000; // 5초

// 3. 거래 기록 캐싱 (ArbitrageRecordService)
private readonly CACHE_DURATION = 10000; // 10초
```

#### **캐시 무효화 전략**

```typescript
// 데이터 변경 시 캐시 무효화
async updateArbitrageRecord(id: string, data: Partial<ArbitrageCycle>): Promise<void> {
  await this.arbitrageCycleRepository.update(id, data);
  this.clearCache(); // 캐시 무효화
}
```

### 5.2. 배치 처리

#### **거래 기록 배치 업데이트**

```typescript
async batchUpdateArbitrageRecords(updates: Array<{id: string, data: Partial<ArbitrageCycle>}>): Promise<void> {
  const updatePromises = updates.map(({ id, data }) =>
    this.arbitrageCycleRepository.update(id, data)
  );
  await Promise.all(updatePromises);
}
```

### 5.3. 비동기 처리

#### **Promise 체인 최적화**

```typescript
// 기존: 순차 처리
const result1 = await step1();
const result2 = await step2(result1);
const result3 = await step3(result2);

// 개선: 병렬 처리
const [result1, result2] = await Promise.all([step1(), step2()]);
const result3 = await step3(result1, result2);
```

### 5.4. API 호출 최적화

#### **stepSize 조정 최적화**

```typescript
// stepSize 조정 후 잔고 초과 방지
const precision = Math.max(stepSize.indexOf('1') - 1, 0);
const stepAdjustedAmount = parseFloat(adjustedAmountToSell.toFixed(precision));
const finalAmount = Math.min(stepAdjustedAmount, actualBalance);
```

#### **입금 확인 최적화**

```typescript
// 50% 기준 입금 확인 (기존 95%에서 개선)
const depositPercentage = (actualIncrease / expectedAmount) * 100;
if (depositPercentage >= 50) {
  // 입금 완료로 처리
}
```

---

## 6. 보안 아키텍처 (Security Architecture)

### 6.1. API 키 관리

```typescript
// 환경 변수를 통한 안전한 API 키 관리
@Injectable()
export class UpbitService {
  private readonly accessKey: string;
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.accessKey = this.configService.get<string>('UPBIT_ACCESS_KEY');
    this.secretKey = this.configService.get<string>('UPBIT_SECRET_KEY');
  }
}
```

### 6.2. 에러 처리 및 로깅

```typescript
// 중앙화된 에러 처리
@Injectable()
export class ErrorHandlerService {
  handleError(error: Error, context: string): void {
    this.logger.error(`[${context}] ${error.message}`, error.stack);

    // 중요 에러는 텔레그램 알림
    if (this.isCriticalError(error)) {
      this.telegramService.sendMessage(`🚨 Critical Error: ${error.message}`);
    }
  }
}
```

---

## 7. 확장성 아키텍처 (Scalability Architecture)

### 7.1. 모듈 확장성

새로운 거래소 추가 시:

```typescript
// 1. 새로운 거래소 모듈 생성
@Module({
  providers: [NewExchangeService],
  exports: [NewExchangeService],
})
export class NewExchangeModule {}

// 2. CommonModule에 추가
@Module({
  imports: [NewExchangeModule],
  // ...
})
export class CommonModule {}
```

### 7.2. 세션 확장성

세션 수 증가에 따른 성능 최적화:

```typescript
// 세션 우선순위 기반 처리
@Injectable()
export class SessionPriorityService {
  calculatePriority(session: ISession): number {
    // 세션 우선순위 계산 로직
    return priority;
  }
}
```

### 7.3. Reverse 모드 확장성

```typescript
// Reverse 모드 상태 관리
export enum SessionStatus {
  AWAITING_HIGH_PREMIUM = 'AWAITING_HIGH_PREMIUM',
  AWAITING_SECOND_STEP = 'AWAITING_SECOND_STEP', // Reverse 모드 2단계 대기
  FAILED = 'FAILED',
  COMPLETED = 'COMPLETED',
}
```

### 7.4. 데이터베이스 확장성

```typescript
// 인덱스 최적화
@Entity()
@Index(['created_at', 'status']) // 복합 인덱스
@Index(['session_id']) // 세션별 조회 최적화
export class ArbitrageCycle {
  // ...
}
```

---

## 8. 모니터링 아키텍처 (Monitoring Architecture)

### 8.1. 성능 모니터링

```typescript
// 성능 측정 데코레이터
export function PerformanceMonitor() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      const result = await originalMethod.apply(this, args);
      const duration = Date.now() - start;

      this.logger.debug(`${propertyKey} 실행 시간: ${duration}ms`);
      return result;
    };
  };
}
```

### 8.2. 비즈니스 모니터링

```typescript
// 거래 성공률 추적
@Injectable()
export class MonitoringService {
  trackTradeSuccess(sessionId: string, success: boolean): void {
    // 성공률 통계 업데이트
    this.updateSuccessRate(sessionId, success);
  }
}
```

### 8.3. 세션 상태 모니터링

```typescript
// 세션 상태 추적
@Injectable()
export class SessionMonitoringService {
  trackSessionState(sessionId: string, status: SessionStatus): void {
    // 세션 상태 변경 로깅
    this.logger.log(`Session ${sessionId} 상태 변경: ${status}`);

    // 상태별 통계 업데이트
    this.updateSessionStatistics(status);
  }
}
```

---

## 9. 테스트 아키텍처 (Testing Architecture)

### 9.1. 단위 테스트

```typescript
// 서비스 단위 테스트
describe('PortfolioManagerService', () => {
  let service: PortfolioManagerService;
  let mockPortfolioLogService: jest.Mocked<PortfolioLogService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PortfolioManagerService,
        {
          provide: PortfolioLogService,
          useValue: createMockPortfolioLogService(),
        },
      ],
    }).compile();

    service = module.get<PortfolioManagerService>(PortfolioManagerService);
    mockPortfolioLogService = module.get(PortfolioLogService);
  });

  it('should calculate investment amount correctly', async () => {
    // 테스트 로직
  });
});
```

### 9.2. 통합 테스트

```typescript
// 모듈 통합 테스트
describe('ArbitrageModule Integration', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ArbitrageModule],
    }).compile();
  });

  it('should process arbitrage opportunity correctly', async () => {
    // 통합 테스트 로직
  });
});
```

### 9.3. Reverse 모드 테스트

```typescript
// Reverse 모드 테스트
describe('Reverse Mode Integration', () => {
  it('should complete reverse mode cycle successfully', async () => {
    // 1단계 테스트
    const lpResult = await sessionExecutorService.executeLowPremiumStep(
      session,
      opportunity,
    );
    expect(lpResult.success).toBe(true);

    // 2단계 테스트
    const hpResult =
      await sessionExecutorService.executeHighPremiumStep(session);
    expect(hpResult.success).toBe(true);
  });
});
```

---

## 10. 배포 아키텍처 (Deployment Architecture)

### 10.1. 환경별 설정

```typescript
// 환경별 설정 관리
@Injectable()
export class ConfigService {
  getDatabaseConfig(): DatabaseConfig {
    const env = process.env.NODE_ENV || 'development';

    switch (env) {
      case 'production':
        return {
          host: process.env.DB_HOST,
          port: parseInt(process.env.DB_PORT),
          // ...
        };
      case 'development':
        return {
          host: 'localhost',
          port: 3306,
          // ...
        };
    }
  }
}
```

### 10.2. 컨테이너화

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
```

---

## 11. 장애 복구 아키텍처 (Disaster Recovery Architecture)

### 11.1. 자동 복구 메커니즘

```typescript
// 연결 재시도 로직
@Injectable()
export class WebSocketService {
  private async connectWithRetry(): Promise<void> {
    let retryCount = 0;
    const maxRetries = 5;

    while (retryCount < maxRetries) {
      try {
        await this.connect();
        break;
      } catch (error) {
        retryCount++;
        await this.delay(1000 * retryCount); // 지수 백오프
      }
    }
  }
}
```

### 11.2. 세션 복구 메커니즘

```typescript
// 세션 상태 복구
@Injectable()
export class SessionRecoveryService {
  async recoverFailedSessions(): Promise<void> {
    const failedSessions = await this.sessionStateService.getSessionsByStatus(
      SessionStatus.FAILED,
    );

    for (const session of failedSessions) {
      await this.attemptSessionRecovery(session);
    }
  }
}
```

### 11.3. 데이터 백업

```typescript
// 중요 데이터 백업
@Injectable()
export class BackupService {
  @Cron('0 2 * * *') // 매일 새벽 2시
  async backupCriticalData(): Promise<void> {
    // 포트폴리오 데이터 백업
    await this.backupPortfolioData();

    // 거래 기록 백업
    await this.backupArbitrageRecords();
  }
}
```

---

## 12. 성능 지표 (Performance Metrics)

### 12.1. 시스템 성능 지표

- **응답 시간**: API 호출 평균 응답 시간 < 100ms
- **처리량**: 초당 처리 가능한 거래 기회 수
- **가용성**: 99.9% 이상의 시스템 가용성
- **메모리 사용량**: 최대 2GB 메모리 사용

### 12.2. 비즈니스 성능 지표

- **거래 성공률**: 95% 이상의 거래 성공률
- **수익률**: 목표 수익률 대비 실제 수익률
- **세션 회전율**: 세션당 평균 처리 시간

### 12.3. Reverse 모드 성능 지표

- **1단계 성공률**: Reverse 모드 1단계 성공률
- **2단계 성공률**: Reverse 모드 2단계 성공률
- **전체 사이클 완료율**: Reverse 모드 전체 사이클 완료율

---

## 13. 최근 개선사항 (Recent Improvements)

### 13.1. 세션 상태 관리 개선

- **StrategyLowService.handleLowPremiumFlow 반환 타입 변경**: `Promise<void>` → `Promise<{success: boolean, error?: string}>`
- **SessionExecutorService 결과 처리 로직 추가**: 세션 실행 결과에 따른 적절한 상태 업데이트
- **Reverse 모드 세션 상태 추가**: `AWAITING_SECOND_STEP` 상태 추가

### 13.2. 입금 확인 로직 개선

- **입금 확인 기준 변경**: 95% → 50% 기준으로 완화
- **입금 내역 API 통합**: 거래소 API를 통한 입금 내역 조회
- **상세 로깅 추가**: 입금 과정의 상세한 로깅

### 13.3. stepSize 조정 로직 개선

- **BinanceService.getSymbolInfo 메서드 추가**: 심볼 정보 조회 기능
- **ExchangeService.getSymbolInfo 메서드 추가**: 거래소별 심볼 정보 조회
- **잔고 초과 방지 로직**: stepSize 조정 후 잔고 초과 방지

### 13.4. 에러 처리 개선

- **소수점 정밀도 오류 해결**: stepSize 조정 과정에서 발생하는 정밀도 오류 해결
- **재시도 로직 개선**: 일시적 오류에 대한 자동 재시도
- **에러 분류**: 치명적 오류와 일시적 오류 구분

---

> **마지막 업데이트**: 2025년 7월 21일
> **버전**: v1.1
> **주요 변경사항**:
>
> - Reverse 모드 아키텍처 추가
> - 세션 상태 관리 개선
> - 입금 확인 로직 개선
> - stepSize 조정 로직 개선
> - 에러 처리 개선
