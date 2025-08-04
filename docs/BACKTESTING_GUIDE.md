# kimP Backtesting Guide

## 개요

kimP 시스템의 백테스팅 기능을 사용하여 과거 데이터를 기반으로 차익거래 전략의 성능을 분석할 수 있습니다. 이 가이드는 데이터 업로드부터 결과 분석까지의 전체 과정을 단계별로 설명합니다.

## 필수 데이터 형식

### CSV 파일 요구사항

백테스팅을 위해서는 다음과 같은 형식의 CSV 파일이 필요합니다:

#### 필수 컬럼

```csv
candle_date_time_kst,trade_price,opening_price,high_price,low_price,candle_acc_trade_price,candle_acc_trade_volume
2024-01-01 00:00:00,50000000,49900000,50100000,49800000,1000000000,20.5
2024-01-01 00:01:00,50100000,50000000,50200000,50000000,1100000000,22.0
```

#### 컬럼 설명

- `candle_date_time_kst`: 캔들 시간 (KST, 한국 표준시)
- `trade_price`: 거래 가격 (KRW)
- `opening_price`: 시가 (KRW)
- `high_price`: 고가 (KRW)
- `low_price`: 저가 (KRW)
- `candle_acc_trade_price`: 누적 거래대금 (KRW)
- `candle_acc_trade_volume`: 누적 거래량

#### 지원 시간대

- **1분**: 1분 단위 캔들 데이터
- **5분**: 5분 단위 캔들 데이터
- **1시간**: 1시간 단위 캔들 데이터
- **1일**: 일봉 데이터

#### 데이터 품질 요구사항

- 시간순 정렬 (오름차순)
- 중복 데이터 없음
- 누락된 값 없음
- 유효한 가격 범위 (0보다 큰 값)

## 단계별 백테스팅 가이드

### Step 1: 데이터 업로드

#### 1.1 대시보드 접속

```bash
# 프론트엔드 서버 시작
cd apps/kim-p-dashboard-fe
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

#### 1.2 데이터 관리 페이지로 이동

- 메인 페이지에서 "Data Management" 카드 클릭
- 또는 직접 `http://localhost:3000/data-management` 접속

#### 1.3 CSV 파일 업로드

1. "Upload Historical Data" 섹션에서 파일 선택
2. 심볼 입력 (예: `xrp`, `btc`, `eth`)
3. "Upload Data" 버튼 클릭
4. 업로드 완료 메시지 확인

#### 1.4 업로드된 데이터 확인

- "Uploaded Datasets" 섹션에서 업로드된 데이터 확인
- 데이터 개수, 날짜 범위, 상태 확인

### Step 2: 시스템 실행 (백테스팅 모드)

#### 2.1 환경 변수 설정

```bash
# .env 파일 생성 또는 수정
FEEDER_MODE=backtest
REDIS_HOST=localhost
REDIS_PORT=6379
DATABASE_URL=sqlite:./data/kimp.db
```

#### 2.2 Redis 서버 시작

```bash
# Redis 서버가 실행 중인지 확인
redis-server

# 또는 Docker 사용
docker run -d -p 6379:6379 redis:alpine
```

#### 2.3 마이크로서비스 시작

**Feeder 서비스 (백테스팅 모드)**

```bash
cd apps/kim-p-feeder
npm run start:dev
```

**Initiator 서비스**

```bash
cd apps/kim-p-initiator
npm run start:dev
```

**Finalizer 서비스**

```bash
cd apps/kim-p-finalizer
npm run start:dev
```

**Dashboard Backend**

```bash
cd apps/kim-p-dashboard-be
npm run start:dev
```

#### 2.4 백테스팅 실행 확인

- Feeder 서비스 로그에서 "백테스팅 모드로 시작합니다..." 메시지 확인
- 과거 데이터 처리 진행률 모니터링
- "모든 과거 데이터 처리 완료" 메시지 확인

### Step 3: 결과 분석

#### 3.1 결과 대시보드 접속

- 메인 페이지에서 "Results Dashboard" 카드 클릭
- 또는 직접 `http://localhost:3000/results-dashboard` 접속

#### 3.2 성능 메트릭 확인

**주요 지표**

- **총 손익 (Total P&L)**: 전체 백테스팅 기간의 순손익
- **ROI (Return on Investment)**: 투자 대비 수익률
- **총 거래 횟수**: 실행된 거래의 총 개수
- **승률 (Win Rate)**: 수익 거래의 비율

**차트 및 그래프**

- 일별/시간별 수익률 변화
- 거래별 손익 분포
- 스프레드 분포 히스토그램
- 거래량 대비 수익률

#### 3.3 거래 내역 분석

- 개별 거래의 상세 정보
- 거래 타입별 성과 분석
- 심볼별 성과 비교
- 실패한 거래의 원인 분석

## 고급 백테스팅 기능

### 설정 조정

#### 최소 스프레드 설정

```bash
# 시스템 설정에서 조정 가능
INITIATOR_MIN_SPREAD=0.5  # 최소 0.5% 스프레드
FINALIZER_MIN_PROFIT=0.1  # 최소 0.1% 수익률
```

#### 투자 금액 설정

```bash
# 포트폴리오 설정에서 조정
INITIAL_INVESTMENT_AMOUNT=1000000  # 100만원
MAX_INVESTMENT_PER_TRADE=100000    # 거래당 최대 10만원
```

### 다중 심볼 백테스팅

1. 여러 심볼의 CSV 파일을 순차적으로 업로드
2. 각 심볼별로 개별 백테스팅 실행
3. 포트폴리오 관점에서 전체 성과 분석

### 백테스팅 결과 내보내기

#### CSV 내보내기

- 거래 내역을 CSV 형식으로 다운로드
- 성능 메트릭을 Excel 형식으로 내보내기

#### 리포트 생성

- PDF 형태의 백테스팅 리포트 생성
- 차트와 그래프가 포함된 상세 분석

## 문제 해결

### 일반적인 오류 및 해결 방법

#### 1. 데이터 업로드 실패

**문제**: CSV 파일 업로드 시 오류 발생
**해결**:

- CSV 형식 확인 (컬럼명, 데이터 타입)
- 파일 크기 확인 (100MB 이하 권장)
- 네트워크 연결 상태 확인

#### 2. 백테스팅 실행 실패

**문제**: 백테스팅 모드에서 데이터 처리 중단
**해결**:

- Redis 연결 상태 확인
- 데이터베이스 연결 확인
- 로그에서 구체적인 오류 메시지 확인

#### 3. 결과 조회 실패

**문제**: 백테스팅 완료 후 결과가 표시되지 않음
**해결**:

- 데이터베이스에 거래 기록이 저장되었는지 확인
- 포트폴리오 로그 생성 여부 확인
- API 엔드포인트 응답 확인

### 성능 최적화

#### 1. 대용량 데이터 처리

- 데이터를 청크 단위로 분할하여 업로드
- 백테스팅 실행 시 메모리 사용량 모니터링
- 필요시 데이터베이스 인덱스 최적화

#### 2. 실행 시간 단축

- 병렬 처리 설정 조정
- 불필요한 로깅 레벨 조정
- 캐싱 설정 최적화

## 모니터링 및 로깅

### 로그 확인 방법

#### Feeder 서비스 로그

```bash
# 백테스팅 진행률 확인
tail -f logs/kim-p-feeder.log | grep "백테스팅"
```

#### Initiator 서비스 로그

```bash
# 기회 감지 및 거래 실행 확인
tail -f logs/kim-p-initiator.log | grep "기회감지"
```

#### Finalizer 서비스 로그

```bash
# 사이클 완료 처리 확인
tail -f logs/kim-p-finalizer.log | grep "사이클"
```

### 성능 메트릭

#### 시스템 리소스 모니터링

- CPU 사용률
- 메모리 사용량
- 네트워크 I/O
- 디스크 I/O

#### 애플리케이션 메트릭

- 처리된 가격 업데이트 수
- 실행된 거래 수
- 평균 응답 시간
- 오류율

## 다음 단계

백테스팅이 완료되면 다음 단계를 고려하세요:

1. **실시간 거래 준비**: 백테스팅 결과를 바탕으로 실시간 거래 설정
2. **전략 최적화**: 성과가 좋지 않은 경우 파라미터 조정
3. **리스크 관리**: 손실 한도 및 포지션 크기 설정
4. **모니터링 시스템**: 실시간 알림 및 대시보드 구축

## 추가 리소스

- [아키텍처 문서](./ARCHITECTURE.md)
- [오류 처리 가이드](./ERROR_HANDLING.md)
- [개선 사항 문서](./IMPROVEMENTS.md)
- [API 문서](./API_REFERENCE.md)
