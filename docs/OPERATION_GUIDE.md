# kimP 시스템 운영 가이드

## 개요

이 문서는 kimP 차익거래 시스템의 개발 환경 설정 및 운영 방법을 상세히 설명합니다.

## 시스템 요구사항

### 필수 소프트웨어

- **Node.js**: v18.0.0 이상
- **Yarn**: v1.22.0 이상
- **MySQL**: v8.0.0 이상
- **Redis**: v6.0.0 이상
- **Git**: v2.30.0 이상

### 권장 사양

- **CPU**: 4코어 이상
- **메모리**: 8GB 이상
- **저장공간**: 10GB 이상
- **네트워크**: 안정적인 인터넷 연결

---

## 1. 개발 환경 설정

### 1.1 저장소 클론

```bash
git clone https://github.com/your-username/kimP-monorepo.git
cd kimP-monorepo
```

### 1.2 의존성 설치

```bash
# 루트 디렉토리에서
yarn install

# 모든 패키지 빌드
yarn build
```

### 1.3 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가합니다:

```env
# 데이터베이스 설정
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=kimp

# Redis 설정
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# API 키 설정 (실제 거래를 위한 경우)
UPBIT_ACCESS_KEY=your_upbit_access_key
UPBIT_SECRET_KEY=your_upbit_secret_key
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET_KEY=your_binance_secret_key

# 텔레그램 알림 설정 (선택사항)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# 포트 설정
FEEDER_PORT=3001
INITIATOR_PORT=3002
FINALIZER_PORT=3003
DASHBOARD_BE_PORT=4000
DASHBOARD_FE_PORT=4001
```

### 1.4 데이터베이스 설정

#### MySQL 설치 및 설정

```bash
# macOS (Homebrew)
brew install mysql
brew services start mysql

# Ubuntu/Debian
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
```

#### 데이터베이스 생성

```bash
mysql -u root -p
```

```sql
CREATE DATABASE kimp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kimp_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON kimp.* TO 'kimp_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 1.5 Redis 설정

```bash
# macOS (Homebrew)
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

#### Redis 연결 테스트

```bash
redis-cli ping
# 응답: PONG
```

---

## 2. 시스템 시작

### 2.1 서비스 시작 순서

시스템을 안정적으로 시작하기 위해 다음 순서를 따라주세요:

1. **데이터베이스 및 Redis 확인**
2. **Feeder 서비스 시작**
3. **Initiator 서비스 시작**
4. **Finalizer 서비스 시작**
5. **Dashboard Backend 시작**
6. **Dashboard Frontend 시작**

### 2.2 단계별 시작

#### 1단계: 데이터베이스 및 Redis 확인

```bash
# MySQL 연결 확인
mysql -u root -p -e "USE kimp; SHOW TABLES;"

# Redis 연결 확인
redis-cli ping
```

#### 2단계: Feeder 서비스 시작

```bash
# 새 터미널 창에서
cd kim-p-monorepo
yarn start:dev kim-p-feeder
```

**정상 시작 확인**:
- 로그에 "PriceFeedService Initialized" 메시지 확인
- WebSocket 연결 성공 메시지 확인
- Redis 연결 성공 메시지 확인

#### 3단계: Initiator 서비스 시작

```bash
# 새 터미널 창에서
yarn start:dev kim-p-initiator
```

**정상 시작 확인**:
- 데이터베이스 연결 성공 메시지 확인
- Redis 구독 성공 메시지 확인
- "OpportunityScannerService initialized" 메시지 확인

#### 4단계: Finalizer 서비스 시작

```bash
# 새 터미널 창에서
yarn start:dev kim-p-finalizer
```

**정상 시작 확인**:
- 데이터베이스 연결 성공 메시지 확인
- 스케줄러 시작 메시지 확인
- 사이클 처리 시작 메시지 확인

#### 5단계: Dashboard Backend 시작

```bash
# 새 터미널 창에서
yarn start:dev kim-p-dashboard-be
```

**정상 시작 확인**:
- 서버가 포트 4000에서 시작됨
- API 엔드포인트 접근 가능

#### 6단계: Dashboard Frontend 시작

```bash
# 새 터미널 창에서
cd apps/kim-p-dashboard-fe
yarn dev
```

**정상 시작 확인**:
- 서버가 포트 4001에서 시작됨
- 브라우저에서 `http://localhost:4001` 접근 가능

---

## 3. 시스템 모니터링

### 3.1 로그 모니터링

각 서비스의 로그를 실시간으로 모니터링합니다:

```bash
# Feeder 로그 확인
tail -f logs/feeder.log

# Initiator 로그 확인
tail -f logs/initiator.log

# Finalizer 로그 확인
tail -f logs/finalizer.log
```

### 3.2 시스템 상태 확인

#### API를 통한 상태 확인

```bash
# 시스템 상태 확인
curl http://localhost:4000/api/health

# 최근 거래 확인
curl http://localhost:4000/api/trades/recent

# 포트폴리오 상태 확인
curl http://localhost:4000/api/portfolio/current
```

#### 데이터베이스 상태 확인

```bash
mysql -u root -p kimp -e "
SELECT 
  COUNT(*) as total_cycles,
  status,
  COUNT(*) as count
FROM arbitrage_cycles 
GROUP BY status;
"
```

### 3.3 성능 모니터링

#### 시스템 리소스 확인

```bash
# CPU 및 메모리 사용량
htop

# 디스크 사용량
df -h

# 네트워크 연결 상태
netstat -i
```

#### Redis 모니터링

```bash
# Redis 메모리 사용량
redis-cli info memory

# Redis 키 개수
redis-cli dbsize
```

---

## 4. 문제 해결

### 4.1 일반적인 문제

#### 서비스 시작 실패

**증상**: 서비스가 시작되지 않거나 즉시 종료됨

**해결 방법**:
1. 환경 변수 확인
2. 포트 충돌 확인
3. 의존성 서비스(DB, Redis) 연결 확인

```bash
# 포트 사용 확인
lsof -i :3001
lsof -i :3002
lsof -i :3003
lsof -i :4000
lsof -i :4001

# 환경 변수 확인
echo $DB_HOST
echo $REDIS_HOST
```

#### 데이터베이스 연결 오류

**증상**: "Database connection failed" 오류

**해결 방법**:
```bash
# MySQL 서비스 상태 확인
sudo systemctl status mysql

# MySQL 재시작
sudo systemctl restart mysql

# 연결 테스트
mysql -u root -p -e "SELECT 1;"
```

#### Redis 연결 오류

**증상**: "Redis connection error" 오류

**해결 방법**:
```bash
# Redis 서비스 상태 확인
sudo systemctl status redis

# Redis 재시작
sudo systemctl restart redis

# 연결 테스트
redis-cli ping
```

### 4.2 성능 문제

#### 메모리 부족

**증상**: "JavaScript heap out of memory" 오류

**해결 방법**:
```bash
# Node.js 메모리 제한 증가
export NODE_OPTIONS="--max-old-space-size=4096"

# 서비스 재시작
yarn start:dev kim-p-feeder
```

#### 느린 응답 시간

**해결 방법**:
1. 데이터베이스 인덱스 확인
2. Redis 메모리 사용량 확인
3. 네트워크 연결 상태 확인

```bash
# 데이터베이스 성능 확인
mysql -u root -p kimp -e "SHOW PROCESSLIST;"

# Redis 성능 확인
redis-cli info stats
```

### 4.3 데이터 문제

#### 사이클이 "stuck" 상태

**해결 방법**:
```sql
-- 타임아웃된 사이클 확인
SELECT id, status, locked_at, retry_count
FROM arbitrage_cycles
WHERE status = 'AWAITING_REBALANCE'
AND locked_at < NOW() - INTERVAL 5 MINUTE;

-- 수동 잠금 해제
UPDATE arbitrage_cycles
SET locked_at = NULL, status = 'AWAITING_REBALANCE'
WHERE id = 'cycle-id-here';
```

#### Dead Letter Queue 처리

```sql
-- DLQ 사이클 조회
SELECT id, status, failure_reason, retry_count, last_retry_at
FROM arbitrage_cycles
WHERE status = 'DEAD_LETTER'
ORDER BY last_retry_at DESC;

-- DLQ에서 복구
UPDATE arbitrage_cycles
SET status = 'AWAITING_REBALANCE',
    retry_count = 0,
    last_retry_at = NULL,
    next_retry_at = NULL,
    failure_reason = NULL,
    locked_at = NULL
WHERE id = 'cycle-id-here';
```

---

## 5. 백업 및 복구

### 5.1 데이터베이스 백업

#### 자동 백업 스크립트

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/mysql"
DB_NAME="kimp"

# 백업 디렉토리 생성
mkdir -p $BACKUP_DIR

# 데이터베이스 백업
mysqldump -u root -p$DB_PASSWORD $DB_NAME > $BACKUP_DIR/kimp_$DATE.sql

# 7일 이상 된 백업 삭제
find $BACKUP_DIR -name "kimp_*.sql" -mtime +7 -delete

echo "Backup completed: kimp_$DATE.sql"
```

#### 백업 실행

```bash
# 수동 백업
chmod +x backup.sh
./backup.sh

# 자동 백업 (cron 설정)
crontab -e
# 매일 새벽 2시에 백업 실행
0 2 * * * /path/to/backup.sh
```

### 5.2 데이터 복구

```bash
# 백업에서 복구
mysql -u root -p kimp < backup/kimp_20240101_020000.sql

# 특정 테이블만 복구
mysql -u root -p kimp -e "DROP TABLE arbitrage_cycles;"
mysql -u root -p kimp arbitrage_cycles < backup/arbitrage_cycles.sql
```

---

## 6. 로그 관리

### 6.1 로그 로테이션

```bash
# logrotate 설정
sudo nano /etc/logrotate.d/kimp

# 설정 내용
/path/to/kimP-monorepo/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 kimp kimp
    postrotate
        systemctl reload kimp-feeder
        systemctl reload kimp-initiator
        systemctl reload kimp-finalizer
    endscript
}
```

### 6.2 로그 분석

```bash
# 오류 로그 검색
grep "ERROR" logs/*.log

# 특정 사이클 로그 검색
grep "cycle-id-here" logs/*.log

# 성능 로그 분석
grep "execution time" logs/*.log | awk '{print $NF}' | sort -n
```

---

## 7. 보안 고려사항

### 7.1 환경 변수 보안

```bash
# .env 파일 권한 설정
chmod 600 .env

# 프로덕션 환경에서는 환경 변수 사용
export DB_PASSWORD="secure_password"
export REDIS_PASSWORD="secure_redis_password"
```

### 7.2 네트워크 보안

```bash
# 방화벽 설정
sudo ufw allow 3001:3003/tcp  # 서비스 포트
sudo ufw allow 4000:4001/tcp  # 대시보드 포트
sudo ufw allow 6379/tcp        # Redis 포트
sudo ufw allow 3306/tcp        # MySQL 포트
```

### 7.3 API 키 보안

- API 키는 환경 변수로 관리
- 정기적인 키 로테이션
- 최소 권한 원칙 적용

---

## 8. 성능 튜닝

### 8.1 데이터베이스 최적화

```sql
-- 인덱스 생성
CREATE INDEX idx_arbitrage_cycles_status ON arbitrage_cycles(status);
CREATE INDEX idx_arbitrage_cycles_start_time ON arbitrage_cycles(start_time);
CREATE INDEX idx_trades_cycle_id ON trades(cycle_id);
CREATE INDEX idx_trades_symbol ON trades(symbol);

-- 테이블 최적화
OPTIMIZE TABLE arbitrage_cycles;
OPTIMIZE TABLE trades;
```

### 8.2 Redis 최적화

```bash
# Redis 설정 최적화
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET maxmemory 1gb
```

### 8.3 Node.js 최적화

```bash
# Node.js 메모리 설정
export NODE_OPTIONS="--max-old-space-size=4096"

# 가비지 컬렉션 최적화
export NODE_OPTIONS="$NODE_OPTIONS --expose-gc"
```

---

## 9. 업데이트 및 배포

### 9.1 코드 업데이트

```bash
# 최신 코드 가져오기
git pull origin main

# 의존성 업데이트
yarn install

# 빌드
yarn build

# 서비스 재시작
yarn restart:all
```

### 9.2 데이터베이스 마이그레이션

```bash
# 마이그레이션 실행
yarn migration:run

# 롤백 (필요시)
yarn migration:revert
```

---

## 10. 모니터링 도구

### 10.1 추천 모니터링 도구

- **Prometheus + Grafana**: 메트릭 수집 및 시각화
- **ELK Stack**: 로그 수집 및 분석
- **Sentry**: 에러 추적 및 알림
- **Datadog**: APM 및 인프라 모니터링

### 10.2 커스텀 모니터링

```bash
# 시스템 상태 스크립트
#!/bin/bash
# health_check.sh

# 서비스 상태 확인
curl -f http://localhost:4000/api/health || echo "Dashboard BE down"
curl -f http://localhost:3001/health || echo "Feeder down"
curl -f http://localhost:3002/health || echo "Initiator down"
curl -f http://localhost:3003/health || echo "Finalizer down"

# 데이터베이스 연결 확인
mysql -u root -p -e "SELECT 1;" || echo "Database down"

# Redis 연결 확인
redis-cli ping || echo "Redis down"
```

---

## 11. 지원 및 연락처

### 11.1 문제 보고

버그나 문제를 발견한 경우:
1. 로그 파일 수집
2. 시스템 상태 정보 수집
3. 재현 단계 작성
4. GitHub 이슈 생성

### 11.2 유용한 명령어

```bash
# 전체 시스템 상태 확인
./scripts/health_check.sh

# 로그 정리
./scripts/clean_logs.sh

# 성능 테스트
./scripts/performance_test.sh

# 백업 생성
./scripts/backup.sh
```

---

## 12. 변경 이력

| 버전 | 날짜 | 변경사항 |
|------|------|----------|
| 1.0.0 | 2024-01-01 | 초기 운영 가이드 작성 |
| 1.1.0 | 2024-01-15 | 문제 해결 섹션 추가 |
| 1.2.0 | 2024-02-01 | 보안 고려사항 추가 | 