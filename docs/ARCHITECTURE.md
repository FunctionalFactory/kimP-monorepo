# kimP Monorepo Architecture

## 시스템 개요

kimP-monorepo는 NestJS와 Next.js 기반의 차익거래 시스템으로, 실시간 가격 모니터링부터 백테스팅까지 완전한 자동화된 거래 플랫폼을 제공합니다.

## 전체 아키텍처 다이어그램

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Upbit API     │    │  Binance API    │    │   Historical    │
│   WebSocket     │    │   WebSocket     │    │   CSV Data      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │     kim-p-feeder         │
                    │   (Price Feed Service)   │
                    │                          │
                    │ • WebSocket 연결 관리     │
                    │ • 실시간 가격 수집        │
                    │ • Redis 발행            │
                    │ • 백테스팅 모드 지원      │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │          Redis             │
                    │     (Message Broker)       │
                    │                            │
                    │ • 가격 업데이트 메시지      │
                    │ • 분산 잠금 관리          │
                    │ • 설정 저장               │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │    kim-p-initiator       │
                    │  (Opportunity Scanner)    │
                    │                          │
                    │ • 기회 감지              │
                    │ • 스프레드 계산          │
                    │ • 거래 실행              │
                    │ • 분산 잠금 관리         │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │      kim-p-finalizer       │
                    │   (Cycle Completion)       │
                    │                            │
                    │ • 재균형 거래 실행         │
                    │ • 사이클 완료 처리         │
                    │ • 재시도 관리             │
                    │ • Dead Letter Queue       │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │         Database          │
                    │      (SQLite/MySQL)       │
                    │                            │
                    │ • ArbitrageCycle          │
                    │ • Trade                   │
                    │ • PortfolioLog            │
                    │ • HistoricalPrice         │
                    │ • SystemSetting           │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   kim-p-dashboard-be      │
                    │   (Backend API)           │
                    │                            │
                    │ • 백테스팅 API            │
                    │ • 데이터 관리 API          │
                    │ • 결과 조회 API           │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │   kim-p-dashboard-fe      │
                    │   (Frontend Dashboard)    │
                    │                            │
                    │ • 데이터 업로드 UI        │
                    │ • 백테스팅 실행 UI        │
                    │ • 결과 시각화            │
                    └─────────────────────────────┘
```

## 컴포넌트별 상세 설명

### 1. kim-p-feeder (가격 피드 서비스)

**역할**: 실시간 가격 데이터 수집 및 분산

**주요 기능**:

- Upbit와 Binance WebSocket 연결 관리
- 실시간 가격 데이터 수집 및 Redis 발행
- 백테스팅 모드를 위한 과거 데이터 시뮬레이션
- 연결 상태 모니터링 및 자동 재연결

**핵심 컴포넌트**:

- `PriceFeedService`: WebSocket 연결 및 가격 처리
- `RedisPublisherService`: Redis 메시지 발행
- `HistoricalPriceService`: 과거 데이터 관리

### 2. kim-p-initiator (기회 스캐너)

**역할**: 차익거래 기회 감지 및 초기 거래 실행

**주요 기능**:

- 실시간 가격 업데이트 수신
- 스프레드 계산 및 수익성 분석
- 분산 잠금을 통한 중복 처리 방지
- 전략별 거래 실행 (HIGH_PREMIUM/LOW_PREMIUM)

**핵심 컴포넌트**:

- `OpportunityScannerService`: 기회 감지 및 필터링
- `TradeExecutorService`: 거래 실행 및 사이클 관리
- `DistributedLockService`: 동시성 제어

### 3. kim-p-finalizer (사이클 완료 처리)

**역할**: 차익거래 사이클의 완료 및 재균형 처리

**주요 기능**:

- 대기 중인 사이클 처리
- 재균형 거래 계획 수립 및 실행
- 재시도 로직 및 Dead Letter Queue 관리
- 포트폴리오 로그 기록

**핵심 컴포넌트**:

- `FinalizerService`: 사이클 완료 처리
- `CycleFinderService`: 처리할 사이클 탐색
- `RetryManagerService`: 재시도 및 오류 처리

### 4. kim-p-dashboard-be (백엔드 API)

**역할**: 백테스팅 및 데이터 관리 API 제공

**주요 기능**:

- CSV 데이터 업로드 및 파싱
- 백테스팅 결과 조회
- 데이터셋 관리
- 시스템 설정 관리

**핵심 컴포넌트**:

- `BacktestingController`: 백테스팅 API 엔드포인트
- `CsvParsingService`: CSV 데이터 파싱
- `SettingsController`: 설정 관리

### 5. kim-p-dashboard-fe (프론트엔드 대시보드)

**역할**: 사용자 인터페이스 및 시각화

**주요 기능**:

- 데이터 업로드 인터페이스
- 백테스팅 실행 가이드
- 결과 시각화 및 차트
- 성능 메트릭 표시

**기술 스택**:

- Next.js 14 (App Router)
- Material-UI
- TypeScript

### 6. kimp-core (공통 라이브러리)

**역할**: 모든 마이크로서비스에서 공유하는 핵심 기능

**주요 모듈**:

#### Database Module

- `ArbitrageCycle`: 차익거래 사이클 엔티티
- `Trade`: 개별 거래 기록 엔티티
- `PortfolioLog`: 포트폴리오 로그 엔티티
- `HistoricalPrice`: 과거 가격 데이터 엔티티

#### Exchange Module

- `ExchangeService`: 거래소 통합 인터페이스
- `UpbitService`: 업비트 API 구현
- `BinanceService`: 바이낸스 API 구현
- `SimulationExchangeService`: 시뮬레이션용 거래소

#### Utils Module

- `SpreadCalculatorService`: 스프레드 계산
- `FeeCalculatorService`: 수수료 계산
- `SlippageCalculatorService`: 슬리피지 계산
- `DistributedLockService`: 분산 잠금
- `RetryManagerService`: 재시도 관리
- `PortfolioManagerService`: 포트폴리오 관리

## 데이터 플로우

### 1. 실시간 거래 플로우

```
1. Price Feed → Redis → Initiator → Database
2. Finalizer → Database → Portfolio Log
3. Dashboard BE → Database → Dashboard FE
```

### 2. 백테스팅 플로우

```
1. CSV Upload → Dashboard BE → Database
2. Feeder (Backtest Mode) → Redis → Initiator
3. Finalizer → Database → Results
4. Dashboard FE → Dashboard BE → Visualization
```

## 상태 관리

### ArbitrageCycle 상태 머신

```
STARTED → INITIAL_TRADE_COMPLETED → AWAITING_REBALANCE →
REBALANCING_IN_PROGRESS → REBALANCE_TRADE_COMPLETED → COMPLETED

FAILED → AWAITING_RETRY → AWAITING_REBALANCE (재시도)

최대 재시도 초과 → DEAD_LETTER
```

### Trade 상태

```
PENDING → COMPLETED/FAILED/CANCELLED
```

## 보안 및 안정성

### 1. 동시성 제어

- Redis 기반 분산 잠금
- 사이클별 고유 ID를 통한 추적
- 타임아웃 기반 잠금 해제

### 2. 오류 처리

- 3단계 재시도 로직 (지수 백오프)
- Dead Letter Queue를 통한 실패 처리
- 텔레그램 알림 시스템

### 3. 데이터 무결성

- 트랜잭션 기반 데이터베이스 작업
- 사이클 ID를 통한 로그 상관관계
- 포트폴리오 로그를 통한 감사 추적

## 확장성 고려사항

### 1. 수평 확장

- Redis를 통한 메시지 브로커링
- 무상태 서비스 설계
- 데이터베이스 커넥션 풀링

### 2. 성능 최적화

- WebSocket 연결 풀링
- Redis 캐싱
- 배치 처리 지원

### 3. 모니터링

- 구조화된 로깅
- 사이클 ID 기반 추적
- 성능 메트릭 수집

## 기술 스택

### Backend

- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: SQLite (개발), MySQL (운영)
- **Message Broker**: Redis
- **Testing**: Jest

### Frontend

- **Framework**: Next.js 14
- **UI Library**: Material-UI
- **Language**: TypeScript
- **Styling**: CSS Modules

### Infrastructure

- **Containerization**: Docker (권장)
- **Process Management**: PM2
- **Monitoring**: Custom logging + Telegram alerts
