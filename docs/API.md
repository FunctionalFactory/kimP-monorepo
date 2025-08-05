# kimP Dashboard API 명세서

## 개요

이 문서는 kimP Dashboard Backend API의 모든 엔드포인트에 대한 상세한 명세를 제공합니다.

## 기본 정보

- **Base URL**: `http://localhost:4000`
- **Content-Type**: `application/json`
- **인증**: 현재 미구현 (향후 JWT 토큰 기반 인증 예정)

## 공통 응답 형식

### 성공 응답
```json
{
  "success": true,
  "data": { ... },
  "message": "요청이 성공적으로 처리되었습니다."
}
```

### 오류 응답
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "오류 메시지",
    "details": { ... }
  }
}
```

---

## 1. 백테스팅 API

### 1.1 데이터 업로드

#### POST `/api/backtest/upload-data`

CSV 파일을 업로드하여 백테스팅용 데이터를 준비합니다.

**요청**:
- **Content-Type**: `multipart/form-data`
- **Body**:
  - `file`: CSV 파일 (필수)
  - `exchange`: 거래소명 (필수, 예: "upbit", "binance")
  - `symbol`: 심볼명 (필수, 예: "BTC", "ETH")
  - `timeframe`: 시간프레임 (필수, 예: "1m", "5m", "1h")

**응답**:
```json
{
  "success": true,
  "data": {
    "uploadedRecords": 1000,
    "symbol": "BTC",
    "exchange": "upbit",
    "timeframe": "1m"
  },
  "message": "데이터 업로드가 완료되었습니다."
}
```

**오류 코드**:
- `400`: 필수 파라미터 누락
- `400`: 유효하지 않은 파일 형식
- `500`: 서버 내부 오류

### 1.2 데이터셋 조회

#### GET `/api/backtest/datasets`

사용 가능한 백테스팅 데이터셋 목록을 조회합니다.

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "exchange": "upbit",
      "symbol": "BTC",
      "timeframe": "1m",
      "recordCount": 1000,
      "dateRange": {
        "start": "2024-01-01T00:00:00Z",
        "end": "2024-01-31T23:59:59Z"
      }
    }
  ]
}
```

### 1.3 백테스팅 세션 생성

#### POST `/api/backtest/sessions`

새로운 백테스팅 세션을 생성합니다.

**요청**:
```json
{
  "exchange": "upbit",
  "symbol": "BTC",
  "timeframe": "1m",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "parameters": {
    "minSpread": 0.5,
    "maxInvestment": 1000000,
    "feeRate": 0.0005
  }
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid-1234-5678",
    "status": "RUNNING",
    "parameters": {
      "minSpread": 0.5,
      "maxInvestment": 1000000,
      "feeRate": 0.0005
    },
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### 1.4 백테스팅 세션 조회

#### GET `/api/backtest/sessions/:id`

특정 백테스팅 세션의 상세 정보를 조회합니다.

**응답**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-1234-5678",
    "status": "COMPLETED",
    "parameters": { ... },
    "results": {
      "totalProfitLoss": 150000,
      "roi": 15.0,
      "totalTrades": 50,
      "winRate": 68.0
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "completedAt": "2024-01-01T01:30:00Z"
  }
}
```

### 1.5 백테스팅 결과 조회

#### GET `/api/backtest/results`

최신 백테스팅 결과를 조회합니다.

**응답**:
```json
{
  "success": true,
  "data": {
    "totalProfitLoss": 150000,
    "roi": 15.0,
    "totalTrades": 50,
    "winRate": 68.0,
    "trades": [
      {
        "id": "trade-123",
        "timestamp": "2024-01-01T00:05:00Z",
        "profit": 5000,
        "symbol": "BTC",
        "tradeType": "HIGH_PREMIUM_BUY"
      }
    ]
  }
}
```

---

## 2. 설정 관리 API

### 2.1 설정 조회

#### GET `/api/settings`

모든 시스템 설정을 조회합니다.

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "key": "INITIATOR_MIN_SPREAD",
      "value": "0.5",
      "description": "Initiator에서 사용할 최소 스프레드 (%)",
      "updatedAt": "2024-01-01T00:00:00Z"
    },
    {
      "key": "FINALIZER_MIN_PROFIT",
      "value": "0.1",
      "description": "Finalizer에서 사용할 최소 수익률 (%)",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 2.2 설정 업데이트

#### PUT `/api/settings/:key`

특정 설정을 업데이트합니다.

**요청**:
```json
{
  "value": "0.6",
  "description": "업데이트된 설명"
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "key": "INITIATOR_MIN_SPREAD",
    "value": "0.6",
    "description": "업데이트된 설명",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

### 2.3 설정 생성

#### POST `/api/settings`

새로운 설정을 생성합니다.

**요청**:
```json
{
  "key": "NEW_SETTING_KEY",
  "value": "new_value",
  "description": "새로운 설정에 대한 설명"
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "key": "NEW_SETTING_KEY",
    "value": "new_value",
    "description": "새로운 설정에 대한 설명",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

## 3. 실시간 모니터링 API

### 3.1 시스템 상태 조회

#### GET `/api/health`

시스템의 전반적인 상태를 조회합니다.

**응답**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00Z",
    "services": {
      "feeder": "running",
      "initiator": "running",
      "finalizer": "running"
    },
    "database": "connected",
    "redis": "connected"
  }
}
```

### 3.2 실시간 거래 현황

#### GET `/api/trades/recent`

최근 거래 내역을 조회합니다.

**Query Parameters**:
- `limit`: 조회할 거래 수 (기본값: 50, 최대: 1000)
- `symbol`: 특정 심볼 필터링 (선택사항)
- `status`: 거래 상태 필터링 (선택사항)

**응답**:
```json
{
  "success": true,
  "data": {
    "trades": [
      {
        "id": "trade-123",
        "symbol": "BTC",
        "tradeType": "HIGH_PREMIUM_BUY",
        "status": "COMPLETED",
        "netProfitKrw": 5000,
        "investmentKrw": 100000,
        "createdAt": "2024-01-01T00:05:00Z",
        "cycleId": "cycle-456"
      }
    ],
    "totalCount": 150,
    "hasMore": true
  }
}
```

### 3.3 포트폴리오 현황

#### GET `/api/portfolio/current`

현재 포트폴리오 상태를 조회합니다.

**응답**:
```json
{
  "success": true,
  "data": {
    "totalBalanceKrw": 1000000,
    "totalPnlKrw": 150000,
    "roiPercentage": 15.0,
    "cyclePnlKrw": 50000,
    "lastUpdated": "2024-01-01T00:00:00Z"
  }
}
```

---

## 4. 통계 API

### 4.1 거래 통계

#### GET `/api/statistics/trades`

거래 관련 통계를 조회합니다.

**Query Parameters**:
- `period`: 기간 (예: "1d", "7d", "30d", "all")
- `symbol`: 특정 심볼 필터링 (선택사항)

**응답**:
```json
{
  "success": true,
  "data": {
    "period": "7d",
    "totalTrades": 150,
    "successfulTrades": 102,
    "failedTrades": 48,
    "winRate": 68.0,
    "totalProfitLoss": 150000,
    "averageProfitPerTrade": 1000,
    "bestTrade": {
      "profit": 5000,
      "symbol": "BTC",
      "timestamp": "2024-01-01T00:05:00Z"
    },
    "worstTrade": {
      "loss": -2000,
      "symbol": "ETH",
      "timestamp": "2024-01-01T00:10:00Z"
    }
  }
}
```

### 4.2 수익성 통계

#### GET `/api/statistics/profitability`

수익성 관련 통계를 조회합니다.

**응답**:
```json
{
  "success": true,
  "data": {
    "totalInvestment": 1000000,
    "currentValue": 1150000,
    "totalReturn": 150000,
    "roi": 15.0,
    "dailyReturns": [
      {
        "date": "2024-01-01",
        "return": 5000,
        "roi": 0.5
      }
    ],
    "monthlyReturns": [
      {
        "month": "2024-01",
        "return": 150000,
        "roi": 15.0
      }
    ]
  }
}
```

---

## 5. 오류 코드

### HTTP 상태 코드

- `200`: 성공
- `400`: 잘못된 요청
- `401`: 인증 실패
- `403`: 권한 없음
- `404`: 리소스 없음
- `500`: 서버 내부 오류

### 비즈니스 오류 코드

- `INVALID_PARAMETER`: 잘못된 파라미터
- `FILE_TOO_LARGE`: 파일 크기 초과
- `INVALID_FILE_FORMAT`: 잘못된 파일 형식
- `DATABASE_ERROR`: 데이터베이스 오류
- `SERVICE_UNAVAILABLE`: 서비스 사용 불가
- `RATE_LIMIT_EXCEEDED`: 요청 제한 초과

---

## 6. WebSocket API

### 6.1 실시간 데이터 스트림

#### WebSocket 연결: `ws://localhost:4000/ws/realtime`

실시간 거래 및 시스템 상태 업데이트를 받습니다.

**연결 후 구독 메시지**:
```json
{
  "type": "subscribe",
  "channels": ["trades", "portfolio", "system_status"]
}
```

**실시간 메시지 형식**:
```json
{
  "type": "trade_update",
  "data": {
    "id": "trade-123",
    "symbol": "BTC",
    "status": "COMPLETED",
    "profit": 5000,
    "timestamp": "2024-01-01T00:05:00Z"
  }
}
```

**채널 목록**:
- `trades`: 실시간 거래 업데이트
- `portfolio`: 포트폴리오 상태 변경
- `system_status`: 시스템 상태 변경
- `price_updates`: 가격 업데이트
- `arbitrage_opportunities`: 차익거래 기회

---

## 7. 사용 예제

### 7.1 백테스팅 실행 예제

```bash
# 1. 데이터 업로드
curl -X POST http://localhost:4000/api/backtest/upload-data \
  -F "file=@data.csv" \
  -F "exchange=upbit" \
  -F "symbol=BTC" \
  -F "timeframe=1m"

# 2. 백테스팅 세션 생성
curl -X POST http://localhost:4000/api/backtest/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "exchange": "upbit",
    "symbol": "BTC",
    "timeframe": "1m",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T23:59:59Z",
    "parameters": {
      "minSpread": 0.5,
      "maxInvestment": 1000000
    }
  }'

# 3. 결과 조회
curl http://localhost:4000/api/backtest/results
```

### 7.2 설정 관리 예제

```bash
# 설정 조회
curl http://localhost:4000/api/settings

# 설정 업데이트
curl -X PUT http://localhost:4000/api/settings/INITIATOR_MIN_SPREAD \
  -H "Content-Type: application/json" \
  -d '{"value": "0.6", "description": "업데이트된 최소 스프레드"}'
```

---

## 8. 개발자 노트

### 8.1 인증 및 권한

현재 API는 인증이 구현되지 않았습니다. 향후 JWT 토큰 기반 인증을 추가할 예정입니다.

### 8.2 요청 제한

- **일반 API**: 분당 1000회 요청
- **백테스팅 API**: 분당 10회 요청
- **파일 업로드**: 최대 100MB

### 8.3 버전 관리

API 버전은 URL 경로에 포함됩니다 (예: `/api/v1/backtest`). 현재는 v1을 사용합니다.

### 8.4 로깅

모든 API 요청은 로그에 기록됩니다. 민감한 정보는 마스킹 처리됩니다.

---

## 9. 변경 이력

| 버전 | 날짜 | 변경사항 |
|------|------|----------|
| 1.0.0 | 2024-01-01 | 초기 API 명세서 작성 |
| 1.1.0 | 2024-01-15 | WebSocket API 추가 |
| 1.2.0 | 2024-02-01 | 통계 API 추가 | 