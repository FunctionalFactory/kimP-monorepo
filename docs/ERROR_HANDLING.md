# kimP Error Handling Guide

## 개요

kimP 시스템은 분산 환경에서 안정적으로 운영되도록 다양한 오류 처리 및 복구 메커니즘을 구현하고 있습니다. 이 문서는 시스템의 오류 처리 방식과 문제 해결 방법을 상세히 설명합니다.

## 오류 처리 아키텍처

### 1. 동시성 오류 처리

#### 분산 잠금 메커니즘

```typescript
// DistributedLockService를 통한 동시성 제어
const lockKey = `lock:${symbol}`;
const lockTTL = 30000; // 30초 잠금

const lockAcquired = await this.distributedLockService.acquireLock(
  lockKey,
  lockTTL,
);

if (!lockAcquired) {
  this.logger.warn(`[${symbol}] 중복 처리 방지: 이미 처리 중인 기회입니다`);
  return;
}
```

**동작 원리**:

- Redis를 사용한 분산 잠금 구현
- NX (Not eXists) 옵션으로 키가 없을 때만 설정
- PX (milliseconds) 옵션으로 TTL 설정
- 자동 타임아웃으로 "stuck" 사이클 방지

**잠금 해제**:

```typescript
// finally 블록에서 항상 잠금 해제
finally {
  await this.distributedLockService.releaseLock(lockKey);
}
```

#### 사이클 상태 관리

```typescript
// ArbitrageCycle 상태 머신
enum CycleStatus {
  STARTED = 'STARTED',
  INITIAL_TRADE_COMPLETED = 'INITIAL_TRADE_COMPLETED',
  AWAITING_REBALANCE = 'AWAITING_REBALANCE',
  REBALANCING_IN_PROGRESS = 'REBALANCING_IN_PROGRESS',
  REBALANCE_TRADE_COMPLETED = 'REBALANCE_TRADE_COMPLETED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  AWAITING_RETRY = 'AWAITING_RETRY',
  DEAD_LETTER = 'DEAD_LETTER',
}
```

### 2. 일시적 오류 처리

#### 재시도 매니저 (RetryManagerService)

**지수 백오프 전략**:

```typescript
// 지수 백오프 계산 (10분 * 2^retryCount)
const delayMinutes = 10 * Math.pow(2, cycle.retryCount - 1);
const nextRetryTime = new Date(Date.now() + delayMinutes * 60 * 1000);
```

**재시도 로직**:

1. **1차 재시도**: 10분 후
2. **2차 재시도**: 20분 후
3. **3차 재시도**: 40분 후
4. **4차 재시도**: 80분 후
5. **5차 재시도**: 160분 후
6. **최대 재시도 초과**: Dead Letter Queue로 이동

#### Dead Letter Queue (DLQ)

**DLQ 이동 조건**:

- 최대 재시도 횟수 (5회) 초과
- 복구 불가능한 오류
- 수동 개입이 필요한 상황

**DLQ 처리**:

```typescript
private async moveToDeadLetterQueue(cycle: ArbitrageCycle, error: Error) {
  cycle.status = 'DEAD_LETTER';
  cycle.nextRetryAt = null;

  // 텔레그램 알림 전송
  await this.telegramService.sendMessage(
    `🚨 **Dead Letter Queue Alert**\n\n` +
    `Cycle ID: \`${cycle.id}\`\n` +
    `Retry Count: ${cycle.retryCount}\n` +
    `Final Error: ${error.message}`
  );
}
```

### 3. 로깅 및 추적

#### 사이클 ID 기반 상관관계

```typescript
// LoggingService.run으로 컨텍스트 설정
await LoggingService.run({ cycleId }, async () => {
  this.loggingService.info(`차익거래 사이클 시작됨`, {
    service: 'TradeExecutorService',
    cycleId,
    symbol: opportunity.symbol,
  });
});
```

**로그 구조**:

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "info",
  "cycleId": "uuid-1234-5678",
  "service": "TradeExecutorService",
  "message": "차익거래 사이클 시작됨",
  "metadata": {
    "symbol": "xrp",
    "investmentAmount": 1000000
  }
}
```

## 일반적인 오류 및 해결 방법

### 1. WebSocket 연결 오류

#### 증상

```
🔌 [Upbit] Disconnected for KRW-XRP. Code: 1006, Reason: . Reconnecting...
🔥 [Binance] xrpusdt WebSocket Error: ECONNRESET
```

#### 해결 방법

1. **네트워크 연결 확인**

   ```bash
   ping api.upbit.com
   ping stream.binance.com
   ```

2. **방화벽 설정 확인**

   ```bash
   # 포트 443, 9443 접근 가능 여부 확인
   telnet api.upbit.com 443
   telnet stream.binance.com 9443
   ```

3. **자동 재연결 확인**
   - Feeder 서비스가 자동으로 5초 후 재연결 시도
   - 로그에서 재연결 성공 메시지 확인

### 2. Redis 연결 오류

#### 증상

```
Redis 연결 오류: ECONNREFUSED
잠금 획득 실패: Redis 연결 실패
```

#### 해결 방법

1. **Redis 서버 상태 확인**

   ```bash
   redis-cli ping
   # 응답: PONG
   ```

2. **Redis 설정 확인**

   ```bash
   # .env 파일에서 Redis 설정 확인
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=your_password
   ```

3. **Redis 재시작**

   ```bash
   # 시스템 Redis
   sudo systemctl restart redis

   # Docker Redis
   docker restart redis-container
   ```

### 3. 데이터베이스 연결 오류

#### 증상

```
TypeORM connection error: SQLITE_CANTOPEN
Database connection failed: ER_ACCESS_DENIED_ERROR
```

#### 해결 방법

1. **데이터베이스 파일 권한 확인**

   ```bash
   ls -la data/kimp.db
   chmod 644 data/kimp.db
   ```

2. **데이터베이스 연결 문자열 확인**

   ```bash
   # .env 파일에서 DATABASE_URL 확인
   DATABASE_URL=sqlite:./data/kimp.db
   ```

3. **데이터베이스 파일 재생성**

   ```bash
   # 기존 파일 백업
   cp data/kimp.db data/kimp.db.backup

   # 새 파일 생성
   touch data/kimp.db
   chmod 644 data/kimp.db
   ```

### 4. 사이클이 "stuck" 상태

#### 증상

- 사이클이 `AWAITING_REBALANCE` 상태에서 멈춤
- `lockedAt` 시간이 30초 이상 경과
- Finalizer가 사이클을 처리하지 않음

#### 해결 방법

1. **잠금 상태 확인**

   ```sql
   SELECT id, status, locked_at, retry_count
   FROM arbitrage_cycles
   WHERE status = 'AWAITING_REBALANCE'
   AND locked_at < datetime('now', '-30 seconds');
   ```

2. **수동 잠금 해제**

   ```sql
   UPDATE arbitrage_cycles
   SET locked_at = NULL
   WHERE id = 'cycle-id-here';
   ```

3. **Finalizer 서비스 재시작**
   ```bash
   cd apps/kim-p-finalizer
   npm run start:dev
   ```

### 5. Dead Letter Queue 처리

#### DLQ 사이클 조회

```sql
SELECT id, status, failure_reason, retry_count, last_retry_at
FROM arbitrage_cycles
WHERE status = 'DEAD_LETTER'
ORDER BY last_retry_at DESC;
```

#### DLQ에서 복구

```typescript
// RetryManagerService를 통한 수동 복구
const recovered = await this.retryManagerService.recoverFromDeadLetter(cycleId);
if (recovered) {
  console.log(`사이클 ${cycleId}가 DLQ에서 복구되었습니다.`);
}
```

### 6. 메모리 부족 오류

#### 증상

```
FATAL ERROR: Ineffective mark-compacts near heap limit
JavaScript heap out of memory
```

#### 해결 방법

1. **Node.js 메모리 제한 증가**

   ```bash
   # package.json 스크립트 수정
   "start:dev": "node --max-old-space-size=4096 -r ts-node/register src/main.ts"
   ```

2. **가비지 컬렉션 최적화**

   ```typescript
   // 주기적 메모리 정리
   setInterval(() => {
     if (global.gc) {
       global.gc();
     }
   }, 30000);
   ```

3. **데이터 처리 배치 크기 조정**
   ```typescript
   // 백테스팅 시 배치 크기 조정
   const BATCH_SIZE = 1000; // 메모리 상황에 따라 조정
   ```

## 모니터링 및 알림

### 1. 텔레그램 알림

#### 설정 방법

```bash
# .env 파일에 텔레그램 설정 추가
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

#### 알림 유형

- **Dead Letter Queue 알림**: 수동 개입 필요
- **재시도 알림**: 재시도 횟수 임계값 도달
- **시스템 상태 알림**: 서비스 시작/종료
- **성능 알림**: 처리량 저하 감지

### 2. 로그 모니터링

#### 로그 레벨 설정

```typescript
// 개발 환경
const logLevel = 'debug';

// 운영 환경
const logLevel = 'info';
```

#### 로그 파일 관리

```bash
# 로그 로테이션 설정
logrotate /etc/logrotate.d/kimp-logs
```

### 3. 성능 메트릭

#### 주요 지표

- **처리량**: 초당 처리된 가격 업데이트 수
- **응답 시간**: API 응답 시간
- **오류율**: 실패한 요청 비율
- **메모리 사용량**: 힙 메모리 사용량

#### 모니터링 도구

```bash
# 시스템 리소스 모니터링
htop
iotop
netstat -i

# 애플리케이션 메트릭
curl http://localhost:3000/health
```

## 예방적 유지보수

### 1. 정기적인 점검

#### 일일 점검

- [ ] 모든 서비스 상태 확인
- [ ] 로그 파일 크기 확인
- [ ] 데이터베이스 연결 상태 확인
- [ ] Redis 메모리 사용량 확인

#### 주간 점검

- [ ] Dead Letter Queue 정리
- [ ] 오래된 로그 파일 정리
- [ ] 데이터베이스 백업
- [ ] 성능 메트릭 분석

### 2. 백업 및 복구

#### 데이터베이스 백업

```bash
# SQLite 백업
cp data/kimp.db data/kimp.db.backup.$(date +%Y%m%d)

# MySQL 백업
mysqldump -u username -p database_name > backup_$(date +%Y%m%d).sql
```

#### 설정 파일 백업

```bash
# 환경 변수 백업
cp .env .env.backup.$(date +%Y%m%d)

# 설정 파일 백업
cp config/* backup/config/
```

### 3. 성능 최적화

#### 데이터베이스 최적화

```sql
-- 인덱스 생성
CREATE INDEX idx_arbitrage_cycles_status ON arbitrage_cycles(status);
CREATE INDEX idx_trades_cycle_id ON trades(cycle_id);
CREATE INDEX idx_historical_prices_symbol_timestamp ON historical_prices(symbol, timestamp);

-- 테이블 최적화
VACUUM;
ANALYZE;
```

#### Redis 최적화

```bash
# Redis 메모리 사용량 확인
redis-cli info memory

# Redis 키 만료 설정
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

## 긴급 상황 대응

### 1. 시스템 중단 시

#### 즉시 조치

1. **모든 서비스 중지**

   ```bash
   pkill -f "kim-p-"
   ```

2. **데이터베이스 상태 확인**

   ```bash
   sqlite3 data/kimp.db "PRAGMA integrity_check;"
   ```

3. **Redis 상태 확인**
   ```bash
   redis-cli ping
   ```

#### 복구 절차

1. **Redis 재시작**
2. **데이터베이스 복구**
3. **서비스 순차적 시작**
4. **상태 확인**

### 2. 데이터 손실 시

#### 복구 절차

1. **최신 백업 확인**
2. **백업에서 복원**
3. **데이터 무결성 검증**
4. **서비스 재시작**

### 3. 보안 사고 시

#### 즉시 조치

1. **모든 API 키 무효화**
2. **네트워크 접근 차단**
3. **로그 분석**
4. **관련 기관 신고**

## 추가 리소스

- [아키텍처 문서](./ARCHITECTURE.md)
- [백테스팅 가이드](./BACKTESTING_GUIDE.md)
- [개선 사항 문서](./IMPROVEMENTS.md)
- [API 문서](./API_REFERENCE.md)
