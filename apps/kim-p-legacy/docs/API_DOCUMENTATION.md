# kimP API 문서 (API Documentation)

## 개요 (Overview)

이 문서는 kimP 시스템의 주요 서비스들의 API 인터페이스와 사용법을 설명합니다. 각 서비스는 NestJS의 의존성 주입 시스템을 통해 사용됩니다.

---

## 1. 설정 관리 서비스 (Configuration Services)

### 1.1. InvestmentConfigService

**위치**: `src/config/investment-config.service.ts`

**역할**: 투자 전략과 금액 설정을 중앙에서 관리하는 서비스

#### 주요 메서드

##### `getInvestmentConfig(): InvestmentConfig`

투자 설정을 반환합니다 (캐시 적용).

```typescript
interface InvestmentConfig {
  strategy: 'FIXED_AMOUNT' | 'PERCENTAGE' | 'FULL_CAPITAL';
  fixedAmountKrw: number;
  percentage: number;
  initialCapitalKrw: number;
}
```

**반환값**: 현재 투자 설정 객체

##### `calculateInvestmentAmount(currentTotalCapitalKrw: number): number`

현재 설정에 따른 투자금을 계산합니다.

**매개변수**:

- `currentTotalCapitalKrw`: 현재 총 자본금 (KRW)

**반환값**: 계산된 투자 금액 (KRW)

**전략별 계산 방식**:

- `FIXED_AMOUNT`: 고정 금액 사용
- `PERCENTAGE`: 총 자본금의 지정된 비율
- `FULL_CAPITAL`: 전체 자본금 사용

---

## 2. 포트폴리오 관리 서비스 (Portfolio Management Services)

### 2.1. PortfolioManagerService

**위치**: `src/common/portfolio-manager.service.ts`

**역할**: 포트폴리오 정보 조회와 캐싱을 담당하는 중앙화된 서비스

#### 주요 메서드

##### `getCurrentTotalCapital(): Promise<number>`

현재 총 자본금을 안전하게 조회합니다.

**반환값**: 현재 총 자본금 (KRW)

**특징**:

- 포트폴리오 로그가 없으면 초기 자본금 사용
- 오류 발생 시 초기 자본금으로 폴백

##### `getLatestPortfolioSafely(): Promise<PortfolioLog | null>`

포트폴리오 정보를 안전하게 조회합니다 (캐싱 적용).

**반환값**: 최신 포트폴리오 로그 또는 null

**캐싱**: 5초간 캐시 적용

##### `getLatestPortfolioAndInvestment(): Promise<{latestLog: PortfolioLog | null, investmentAmount: number}>`

포트폴리오 정보와 투자 금액을 함께 반환합니다.

**반환값**: 포트폴리오 정보와 계산된 투자 금액

---

## 3. 차익거래 핵심 서비스 (Arbitrage Core Services)

### 3.1. ArbitrageFlowManagerService

**위치**: `src/arbitrage/arbitrage-flow-manager.service.ts`

**역할**: 차익거래 전체 흐름을 관리하는 총괄 책임자

#### 주요 메서드

##### `onModuleInit(): Promise<void>`

모듈 초기화 시 실행되는 메서드

**기능**:

- 가격 피드 구독 설정
- 초기 상태 설정

##### `handlePriceUpdate(priceData: any): Promise<void>`

가격 업데이트를 처리하는 메서드

**매개변수**:

- `priceData`: 실시간 가격 데이터

**기능**:

- 다단계 필터링을 통한 기회 검증
- 세션 상태에 따른 적절한 처리기 호출

### 3.2. HighPremiumProcessorService

**위치**: `src/arbitrage/high-premium-processor.service.ts`

**역할**: 고프리미엄 단계의 기회 검증 및 거래 실행

#### 주요 메서드

##### `processHighPremiumOpportunity(opportunity: HighPremiumConditionData): Promise<boolean>`

고프리미엄 기회를 처리합니다.

**매개변수**:

- `opportunity`: 고프리미엄 조건 데이터

**반환값**: 처리 성공 여부

**처리 과정**:

1. 3단계 필터링 (시세 → 거래대금 → 슬리피지)
2. 거래 실행 요청
3. 상태 업데이트

### 3.3. LowPremiumProcessorService

**위치**: `src/arbitrage/low-premium-processor.service.ts`

**역할**: 저프리미엄 단계의 기회 검증 및 자금 회수

#### 주요 메서드

##### `processLowPremiumOpportunity(): Promise<LowPremiumResult>`

저프리미엄 기회를 처리합니다.

**반환값**: 저프리미엄 처리 결과

**처리 과정**:

1. 허용 가능한 손실 범위 내 코인 검색
2. 가장 효율적인 자금 회수 경로 선택
3. 거래 실행

---

## 4. 세션 관리 서비스 (Session Management Services)

### 4.1. SessionManagerService

**위치**: `src/session/session-manager.service.ts`

**역할**: 세션의 생성, 관리, 상태 추적

#### 주요 메서드

##### `onModuleInit(): Promise<void>`

모듈 초기화 시 실행

**기능**:

- 가격 피드 구독 설정
- 주기적 스캔 설정

##### `@Cron(CronExpression.EVERY_30_SECONDS) scanForOpportunities(): Promise<void>`

30초마다 기회를 스캔하는 메서드

**기능**:

- 고프리미엄 기회 탐색
- 새로운 세션 생성

### 4.2. SessionExecutorService

**위치**: `src/session/session-executor.service.ts`

**역할**: 각 세션의 실행을 담당

#### 주요 메서드

##### `executeSessions(): Promise<void>`

대기 중인 세션들을 실행합니다.

**기능**:

- 세션 우선순위 계산
- 세션 상태에 따른 적절한 처리
- 병렬 처리 관리

##### `executeLowPremiumStep(session: ISession, opportunity: any): Promise<{success: boolean, error?: string}>`

저프리미엄 단계를 실행합니다.

**매개변수**:

- `session`: 실행할 세션 정보
- `opportunity`: 저프리미엄 기회 데이터

**반환값**: 실행 결과 (성공/실패 및 에러 정보)

**기능**:

- Reverse 모드 1단계 처리
- StrategyLowService.handleLowPremiumFlow 호출
- 결과 처리 및 세션 상태 업데이트

##### `executeHighPremiumStep(session: ISession): Promise<{success: boolean, error?: string}>`

고프리미엄 단계를 실행합니다.

**매개변수**:

- `session`: 실행할 세션 정보

**반환값**: 실행 결과 (성공/실패 및 에러 정보)

**기능**:

- Reverse 모드 2단계 처리
- 고프리미엄 기회 탐색 및 처리
- 세션 상태 업데이트

### 4.3. SessionStateService

**위치**: `src/session/session-state.service.ts`

**역할**: 세션의 상태 정보를 메모리에서 관리

#### 주요 메서드

##### `createSession(initialData: Partial<ISession>): string`

새로운 세션을 생성합니다.

**매개변수**:

- `initialData`: 초기 세션 데이터

**반환값**: 생성된 세션 ID

##### `updateSessionStatus(sessionId: string, status: SessionStatus): void`

세션 상태를 업데이트합니다.

**매개변수**:

- `sessionId`: 세션 ID
- `status`: 새로운 상태

**세션 상태**:

- `AWAITING_HIGH_PREMIUM`: 고프리미엄 대기
- `AWAITING_SECOND_STEP`: 2단계 대기 (Reverse 모드)
- `FAILED`: 실패
- `COMPLETED`: 완료

##### `getSession(sessionId: string): ISession | null`

세션 정보를 조회합니다.

**매개변수**:

- `sessionId`: 세션 ID

**반환값**: 세션 정보 또는 null

---

## 5. 거래 실행 서비스 (Trading Execution Services)

### 5.1. ExchangeService

**위치**: `src/common/exchange.service.ts`

**역할**: 거래소 API 통신을 중개하는 단일 창구

#### 주요 메서드

##### `createOrder(exchange: string, symbol: string, side: string, quantity: number, price?: number): Promise<any>`

주문을 생성합니다.

**매개변수**:

- `exchange`: 거래소명 ('upbit' | 'binance')
- `symbol`: 거래 심볼
- `side`: 주문 방향 ('buy' | 'sell')
- `quantity`: 수량
- `price`: 가격 (지정가 주문 시)

**반환값**: 주문 결과

##### `getBalance(exchange: string, asset: string): Promise<number>`

잔고를 조회합니다.

**매개변수**:

- `exchange`: 거래소명
- `asset`: 자산명

**반환값**: 잔고 수량

##### `withdraw(exchange: string, asset: string, amount: number, address: string): Promise<any>`

출금을 요청합니다.

**매개변수**:

- `exchange`: 거래소명
- `asset`: 자산명
- `amount`: 출금 수량
- `address`: 출금 주소

**반환값**: 출금 결과

##### `getDepositHistory(exchange: string, symbol: string, startTime: Date, endTime: Date): Promise<any[]>`

입금 내역을 조회합니다.

**매개변수**:

- `exchange`: 거래소명
- `symbol`: 거래 심볼
- `startTime`: 조회 시작 시간
- `endTime`: 조회 종료 시간

**반환값**: 입금 내역 배열

##### `getSymbolInfo(exchange: string, symbol: string): Promise<any>`

거래소의 심볼 정보를 조회합니다.

**매개변수**:

- `exchange`: 거래소명
- `symbol`: 거래 심볼

**반환값**: 심볼 정보 (stepSize, minQty 등)

### 5.2. StrategyHighService

**위치**: `src/common/strategy-high.service.ts`

**역할**: 고프리미엄 거래 전략 실행

#### 주요 메서드

##### `executeHighPremiumStrategy(opportunity: HighPremiumConditionData): Promise<boolean>`

고프리미엄 전략을 실행합니다.

**매개변수**:

- `opportunity`: 고프리미엄 기회 데이터

**반환값**: 실행 성공 여부

**특징**:

- 호가 추적 로직 포함
- 미체결 주문 자동 재시도

### 5.3. StrategyLowService

**위치**: `src/common/strategy-low.service.ts`

**역할**: 저프리미엄 거래 전략 실행

#### 주요 메서드

##### `handleLowPremiumFlow(symbol: string, upbitPrice: number, binancePrice: number, rate: number, cycleId: string, investmentKRW: number): Promise<{success: boolean, error?: string}>`

저프리미엄 플로우를 처리합니다.

**매개변수**:

- `symbol`: 거래 심볼
- `upbitPrice`: 업비트 가격
- `binancePrice`: 바이낸스 가격
- `rate`: 프리미엄 비율
- `cycleId`: 사이클 ID
- `investmentKRW`: 투자 금액

**반환값**: 처리 결과 (성공/실패 및 에러 정보)

**처리 과정**:

1. 업비트 매수
2. 바이낸스 출금
3. 바이낸스 현물 매도
4. 선물 숏 포지션 진입
5. 입금 확인 (50% 기준, 입금 내역 API 통합)

##### `aggressiveSellOnBinance(cycleId: string, symbol: string, amountToSell: number): Promise<Order>`

바이낸스에서 적극적 매도를 실행합니다.

**매개변수**:

- `cycleId`: 사이클 ID
- `symbol`: 거래 심볼
- `amountToSell`: 매도할 수량

**반환값**: 주문 결과

**특징**:

- stepSize 조정 후 잔고 초과 방지
- 소수점 정밀도 자동 조정
- 재시도 로직 포함

##### `executeLowPremiumStrategy(opportunity: LowPremiumConditionData): Promise<boolean>`

저프리미엄 전략을 실행합니다.

**매개변수**:

- `opportunity`: 저프리미엄 기회 데이터

**반환값**: 실행 성공 여부

---

## 6. 계산 서비스 (Calculation Services)

### 6.1. FeeCalculatorService

**위치**: `src/common/fee-calculator.service.ts`

**역할**: 거래 수수료, 송금 수수료, 헷징 비용 계산

#### 주요 메서드

##### `calculateTotalFees(investmentAmount: number, symbol: string): number`

총 수수료를 계산합니다.

**매개변수**:

- `investmentAmount`: 투자 금액
- `symbol`: 거래 심볼

**반환값**: 총 수수료 (KRW)

**포함 비용**:

- 거래 수수료 (스팟/선물)
- 송금 수수료
- 헷징 비용

### 6.2. SlippageCalculatorService

**위치**: `src/common/slippage-calculator.service.ts`

**역할**: 슬리피지 계산

#### 주요 메서드

##### `calculate(orderBook: any, investmentAmount: number, side: 'buy' | 'sell'): number`

슬리피지를 계산합니다.

**매개변수**:

- `orderBook`: 호가창 데이터
- `investmentAmount`: 투자 금액
- `side`: 거래 방향

**반환값**: 예상 슬리피지 (%)

### 6.3. SpreadCalculatorService

**위치**: `src/common/spread-calculator.service.ts`

**역할**: 스프레드 계산 및 수익성 분석

#### 주요 메서드

##### `calculateSpread(upbitPrice: number, binancePrice: number): number`

스프레드를 계산합니다.

**매개변수**:

- `upbitPrice`: 업비트 가격
- `binancePrice`: 바이낸스 가격

**반환값**: 스프레드 (%)

##### `isProfitableAfterAllCosts(spread: number, investmentAmount: number, symbol: string): boolean`

모든 비용을 고려한 수익성 여부를 판단합니다.

**매개변수**:

- `spread`: 스프레드
- `investmentAmount`: 투자 금액
- `symbol`: 거래 심볼

**반환값**: 수익성 여부

---

## 7. 데이터베이스 서비스 (Database Services)

### 7.1. ArbitrageRecordService

**위치**: `src/db/arbitrage-record.service.ts`

**역할**: 차익거래 기록 관리

#### 주요 메서드

##### `createArbitrageRecord(data: Partial<ArbitrageCycle>): Promise<ArbitrageCycle>`

차익거래 기록을 생성합니다.

**매개변수**:

- `data`: 차익거래 데이터

**반환값**: 생성된 차익거래 기록

##### `updateArbitrageRecord(id: string, data: Partial<ArbitrageCycle>): Promise<void>`

차익거래 기록을 업데이트합니다.

**매개변수**:

- `id`: 기록 ID
- `data`: 업데이트할 데이터

##### `batchUpdateArbitrageRecords(updates: Array<{id: string, data: Partial<ArbitrageCycle>}>): Promise<void>`

여러 차익거래 기록을 배치로 업데이트합니다.

**매개변수**:

- `updates`: 업데이트할 기록 배열

### 7.2. PortfolioLogService

**위치**: `src/db/portfolio-log.service.ts`

**역할**: 포트폴리오 로그 관리

#### 주요 메서드

##### `getLatestPortfolio(): Promise<PortfolioLog | null>`

최신 포트폴리오 로그를 조회합니다.

**반환값**: 최신 포트폴리오 로그 또는 null

##### `createPortfolioLog(data: Partial<PortfolioLog>): Promise<PortfolioLog>`

포트폴리오 로그를 생성합니다.

**매개변수**:

- `data`: 포트폴리오 데이터

**반환값**: 생성된 포트폴리오 로그

---

## 8. 알림 서비스 (Notification Services)

### 8.1. TelegramService

**위치**: `src/common/telegram.service.ts`

**역할**: 텔레그램 알림 전송

#### 주요 메서드

##### `sendMessage(message: string): Promise<void>`

텔레그램 메시지를 전송합니다.

**매개변수**:

- `message`: 전송할 메시지

##### `sendArbitrageResult(result: ArbitrageResult): Promise<void>`

차익거래 결과를 텔레그램으로 전송합니다.

**매개변수**:

- `result`: 차익거래 결과 데이터

### 8.2. NotificationComposerService

**위치**: `src/notification/notification-composer.service.ts`

**역할**: 알림 메시지 구성

#### 주요 메서드

##### `composeArbitrageResultMessage(result: ArbitrageResult): string`

차익거래 결과 메시지를 구성합니다.

**매개변수**:

- `result`: 차익거래 결과

**반환값**: 구성된 메시지

---

## 9. 모니터링 서비스 (Monitoring Services)

### 9.1. DepositMonitorService

**위치**: `src/arbitrage/deposit-monitor.service.ts`

**역할**: 입금 모니터링

#### 주요 메서드

##### `monitorDeposit(exchange: string, asset: string, expectedAmount: number): Promise<boolean>`

입금을 모니터링합니다.

**매개변수**:

- `exchange`: 거래소명
- `asset`: 자산명
- `expectedAmount`: 예상 입금 수량

**반환값**: 입금 완료 여부

**개선사항**:

- 50% 기준 입금 확인 (기존 95%에서 변경)
- 입금 내역 API 통합
- 상세 로깅 추가

### 9.2. SessionFundValidationService

**위치**: `src/db/session-fund-validation.service.ts`

**역할**: 세션 자금 검증

#### 주요 메서드

##### `validateSessionFunds(sessionId: string): Promise<boolean>`

세션 자금을 검증합니다.

**매개변수**:

- `sessionId`: 세션 ID

**반환값**: 자금 충분 여부

---

## 10. 거래소별 서비스 (Exchange-Specific Services)

### 10.1. BinanceService

**위치**: `src/binance/binance.service.ts`

**역할**: 바이낸스 거래소 API 통신

#### 주요 메서드

##### `getSymbolInfo(symbol: string): Promise<any>`

바이낸스 심볼 정보를 조회합니다.

**매개변수**:

- `symbol`: 거래 심볼

**반환값**: 심볼 정보 (stepSize, minQty, precision 등)

**특징**:

- stepSize 조정을 위한 정밀도 정보 제공
- 소수점 자릿수 자동 계산

##### `createOrder(symbol: string, side: string, quantity: number, price?: number): Promise<any>`

바이낸스 주문을 생성합니다.

**매개변수**:

- `symbol`: 거래 심볼
- `side`: 주문 방향 ('buy' | 'sell')
- `quantity`: 수량
- `price`: 가격 (지정가 주문 시)

**반환값**: 주문 결과

**개선사항**:

- stepSize 조정 로직 개선
- 잔고 초과 방지 로직 추가
- 소수점 정밀도 자동 조정

### 10.2. UpbitService

**위치**: `src/upbit/upbit.service.ts`

**역할**: 업비트 거래소 API 통신

#### 주요 메서드

##### `createOrder(symbol: string, side: string, quantity: number, price?: number): Promise<any>`

업비트 주문을 생성합니다.

**매개변수**:

- `symbol`: 거래 심볼
- `side`: 주문 방향 ('bid' | 'ask')
- `quantity`: 수량
- `price`: 가격 (지정가 주문 시)

**반환값**: 주문 결과

---

## 11. 사용 예시 (Usage Examples)

### 11.1. 새로운 세션 생성

```typescript
// SessionManagerService 사용
const sessionId = this.sessionStateService.createSession({
  status: SessionStatus.AWAITING_HIGH_PREMIUM,
  investmentAmount: 250000,
  createdAt: new Date(),
});
```

### 11.2. 투자 금액 계산

```typescript
// InvestmentConfigService 사용
const config = this.investmentConfigService.getInvestmentConfig();
const investmentAmount =
  this.investmentConfigService.calculateInvestmentAmount(1000000);
```

### 11.3. 포트폴리오 조회

```typescript
// PortfolioManagerService 사용
const { latestLog, investmentAmount } =
  await this.portfolioManagerService.getLatestPortfolioAndInvestment();
```

### 11.4. 거래 실행

```typescript
// ExchangeService 사용
const order = await this.exchangeService.createOrder(
  'upbit',
  'BTC-KRW',
  'buy',
  0.001,
  50000000,
);
```

### 11.5. 수수료 계산

```typescript
// FeeCalculatorService 사용
const totalFees = this.feeCalculatorService.calculateTotalFees(
  250000,
  'BTC-KRW',
);
```

### 11.6. Reverse 모드 세션 실행

```typescript
// SessionExecutorService 사용
const result = await this.sessionExecutorService.executeLowPremiumStep(
  session,
  opportunity,
);

if (result && result.success) {
  // 1단계 성공, 2단계로 진행
  await this.sessionExecutorService.executeHighPremiumStep(session);
}
```

### 11.7. 입금 확인

```typescript
// DepositMonitorService 사용
const isDepositCompleted = await this.depositMonitorService.monitorDeposit(
  'binance',
  'XRP',
  100,
);
```

---

## 12. 에러 처리 (Error Handling)

모든 서비스는 적절한 에러 처리를 포함합니다:

- **데이터베이스 오류**: 기본값으로 폴백
- **API 오류**: 재시도 로직 포함
- **네트워크 오류**: 타임아웃 설정
- **로깅**: 모든 오류는 로그로 기록

### 12.1. 주요 에러 타입

#### **잔고 부족 오류**

```typescript
// stepSize 조정 후 잔고 초과 방지
const finalAmount = Math.min(stepAdjustedAmount, actualBalance);
```

#### **입금 확인 오류**

```typescript
// 50% 기준으로 입금 확인
const depositPercentage = (actualIncrease / expectedAmount) * 100;
if (depositPercentage >= 50) {
  // 입금 완료로 처리
}
```

#### **세션 상태 오류**

```typescript
// 세션 실행 결과 처리
if (result && result.success) {
  // 성공 처리
} else {
  // 실패 처리
  this.logger.error(`Session failed: ${result?.error || 'Unknown error'}`);
}
```

---

## 13. 성능 최적화 (Performance Optimization)

### 13.1. 캐싱 전략

- **설정 캐싱**: `InvestmentConfigService` - 1분 캐시
- **포트폴리오 캐싱**: `PortfolioManagerService` - 5초 캐시
- **거래 기록 캐싱**: `ArbitrageRecordService` - 10초 캐시

### 13.2. 배치 처리

- **거래 기록 업데이트**: `batchUpdateArbitrageRecords` 메서드
- **포트폴리오 조회**: 캐싱을 통한 중복 쿼리 방지

### 13.3. 최적화된 API 호출

- **stepSize 조정**: 소수점 정밀도 자동 조정
- **잔고 확인**: 주문 전 잔고 충분성 검증
- **재시도 로직**: 일시적 오류에 대한 자동 재시도

---

> **마지막 업데이트**: 2025년 7월 21일
> **버전**: v1.1
> **주요 변경사항**:
>
> - StrategyLowService.handleLowPremiumFlow 반환 타입 변경
> - 입금 확인 로직 개선 (50% 기준, 입금 내역 API 통합)
> - stepSize 조정 로직 개선
> - Reverse 모드 세션 상태 관리 추가
> - BinanceService.getSymbolInfo 메서드 추가
> - ExchangeService.getSymbolInfo 메서드 추가
