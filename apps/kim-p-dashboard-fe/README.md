# kimP Dashboard Frontend

## 개요

kimP Dashboard Frontend는 실시간 차익거래 시스템의 웹 기반 관리 인터페이스입니다. Next.js를 기반으로 구축되었으며, 실시간 데이터 시각화와 백테스팅 기능을 제공합니다.

## 기술 스택

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks
- **Real-time Communication**: WebSocket
- **Charts**: Chart.js / Recharts
- **UI Components**: Headless UI

## 화면별 기능 설명

### 1. 메인 대시보드 (`/`)

**역할**: 실시간 차익거래 기회 및 현재 시스템 상태를 한눈에 모니터링합니다.

**주요 기능**:

- **실시간 가격 차트**: 업비트와 바이낸스의 실시간 가격 비교
- **차익거래 기회 목록**: 현재 감지된 차익거래 기회들의 실시간 목록
- **시스템 상태 모니터링**: 각 마이크로서비스의 연결 상태 표시
- **포트폴리오 요약**: 현재 투자 금액, 수익률, 총 수익 등
- **최근 거래 내역**: 최근 실행된 거래들의 요약 정보

**핵심 컴포넌트**:

```typescript
// 실시간 가격 차트
<PriceComparisonChart
  upbitPrice={upbitPrice}
  binancePrice={binancePrice}
  spread={calculatedSpread}
/>

// 차익거래 기회 목록
<ArbitrageOpportunities
  opportunities={opportunities}
  onOpportunityClick={handleOpportunityClick}
/>

// 시스템 상태 모니터
<SystemStatusMonitor
  services={serviceStatus}
  lastUpdate={lastUpdate}
/>
```

### 2. 백테스팅 (`/backtesting`)

**역할**: 과거 데이터를 이용해 거래 전략을 테스트하고 성능을 평가합니다.

**주요 기능**:

- **데이터 업로드**: CSV 파일을 통한 과거 가격 데이터 업로드
- **백테스팅 파라미터 설정**:
  - 최소 스프레드 설정
  - 최대 투자 금액 설정
  - 수수료율 설정
  - 테스트 기간 설정
- **백테스팅 실행**: 설정된 파라미터로 백테스팅 실행
- **결과 요약**:
  - 총 수익률
  - 승률
  - 총 거래 횟수
  - 최대 손실
  - 샤프 비율

**핵심 컴포넌트**:

```typescript
// 데이터 업로드 폼
<DataUploadForm
  onUpload={handleDataUpload}
  supportedFormats={['csv']}
/>

// 백테스팅 파라미터 설정
<BacktestParameters
  parameters={parameters}
  onParameterChange={handleParameterChange}
/>

// 백테스팅 결과 요약
<BacktestSummary
  results={backtestResults}
  onViewDetails={handleViewDetails}
/>
```

### 3. 백테스팅 상세 결과 (`/backtesting/[id]`)

**역할**: 특정 백테스팅 실행의 상세 결과를 분석합니다.

**주요 기능**:

- **전체 거래 내역 타임라인**: 백테스팅 기간 동안의 모든 거래 내역
- **기간별 손익 그래프**: 일별/시간별 수익률 변화 시각화
- **상세 로그 데이터**: 각 거래의 상세 정보 (가격, 수수료, 수익 등)
- **성능 메트릭**:
  - 최대 낙폭 (MDD)
  - 변동성
  - 평균 수익률
  - 승률 분석
- **거래 패턴 분석**: 성공/실패 거래의 패턴 분석

**핵심 컴포넌트**:

```typescript
// 거래 타임라인
<TradeTimeline
  trades={trades}
  onTradeSelect={handleTradeSelect}
/>

// 수익률 차트
<ProfitLossChart
  data={profitLossData}
  period="daily"
/>

// 성능 메트릭
<PerformanceMetrics
  metrics={performanceMetrics}
  comparison={benchmarkComparison}
/>
```

### 4. 실시간 거래 모니터링 (`/live-trading`)

**역할**: 현재 자동으로 실행 중인 실시간 거래의 상세 내역을 추적합니다.

**주요 기능**:

- **진행 중인 거래 목록**: 현재 실행 중인 차익거래 사이클 목록
- **체결된 거래 내역**: 완료된 거래들의 상세 정보
- **실시간 로그 스트리밍**: 시스템 로그의 실시간 표시
- **거래 상태 추적**:
  - 거래 시작
  - 거래 진행 중
  - 거래 완료
  - 거래 실패
- **실시간 알림**: 중요한 이벤트 발생 시 실시간 알림

**핵심 컴포넌트**:

```typescript
// 실시간 거래 목록
<LiveTradesList
  trades={liveTrades}
  onTradeUpdate={handleTradeUpdate}
/>

// 실시간 로그 스트림
<LogStream
  logs={systemLogs}
  filter={logFilter}
/>

// 거래 상태 모니터
<TradeStatusMonitor
  status={tradeStatus}
  alerts={tradeAlerts}
/>
```

### 5. 설정 관리 (`/settings`)

**역할**: 시스템 운영에 필요한 설정을 관리합니다.

**주요 기능**:

- **거래소 API 키 관리**:
  - 업비트 API 키 설정
  - 바이낸스 API 키 설정
  - API 키 유효성 검증
- **거래 허용/차단 코인 설정**:
  - 거래 가능한 코인 목록 관리
  - 특정 코인 거래 차단
  - 코인별 최대 투자 금액 설정
- **알림 설정**:
  - 텔레그램 알림 설정
  - 이메일 알림 설정
  - 알림 조건 설정
- **시스템 설정**:
  - 최소 스프레드 설정
  - 최대 투자 금액 설정
  - 수수료율 설정
  - 재시도 횟수 설정

**핵심 컴포넌트**:

```typescript
// API 키 관리
<ApiKeyManager
  exchanges={exchanges}
  onKeyUpdate={handleKeyUpdate}
/>

// 코인 설정
<CoinSettings
  coins={coinSettings}
  onCoinToggle={handleCoinToggle}
/>

// 알림 설정
<NotificationSettings
  settings={notificationSettings}
  onSettingChange={handleSettingChange}
/>
```

## 공통 컴포넌트

### 1. 네비게이션

```typescript
<Navigation
  currentPage={currentPage}
  onPageChange={handlePageChange}
  notifications={notifications}
/>
```

### 2. 실시간 데이터 훅

```typescript
// WebSocket 연결 및 실시간 데이터 관리
const useRealTimeData = () => {
  const [data, setData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:4000/ws/realtime');

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setData(message);
    };

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    return () => ws.close();
  }, []);

  return { data, isConnected };
};
```

### 3. 차트 컴포넌트

```typescript
// 재사용 가능한 차트 컴포넌트
<Chart
  data={chartData}
  type="line" | "bar" | "candlestick"
  options={chartOptions}
  onDataPointClick={handleDataPointClick}
/>
```

## 상태 관리

### 1. 전역 상태

```typescript
// Context API를 사용한 전역 상태 관리
const AppContext = createContext();

const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({});
  const [notifications, setNotifications] = useState([]);

  return (
    <AppContext.Provider value={{
      user, setUser,
      settings, setSettings,
      notifications, setNotifications
    }}>
      {children}
    </AppContext.Provider>
  );
};
```

### 2. 로컬 상태

```typescript
// 각 페이지별 로컬 상태 관리
const useBacktestState = () => {
  const [parameters, setParameters] = useState(defaultParameters);
  const [results, setResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  return {
    parameters,
    setParameters,
    results,
    setResults,
    isRunning,
    setIsRunning,
  };
};
```

## API 통신

### 1. API 클라이언트

```typescript
// axios 기반 API 클라이언트
const apiClient = axios.create({
  baseURL: 'http://localhost:4000/api',
  timeout: 10000,
});

// 인터셉터를 통한 에러 처리
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 인증 실패 처리
    }
    return Promise.reject(error);
  },
);
```

### 2. API 훅

```typescript
// 백테스팅 API 훅
const useBacktestAPI = () => {
  const uploadData = async (file, params) => {
    const formData = new FormData();
    formData.append('file', file);
    Object.keys(params).forEach((key) => {
      formData.append(key, params[key]);
    });

    return await apiClient.post('/backtest/upload-data', formData);
  };

  const createSession = async (sessionData) => {
    return await apiClient.post('/backtest/sessions', sessionData);
  };

  const getResults = async (sessionId) => {
    return await apiClient.get(`/backtest/sessions/${sessionId}`);
  };

  return { uploadData, createSession, getResults };
};
```

## 성능 최적화

### 1. 코드 스플리팅

```typescript
// 동적 임포트를 통한 코드 스플리팅
const BacktestPage = dynamic(() => import('../pages/backtesting'), {
  loading: () => <LoadingSpinner />,
  ssr: false
});
```

### 2. 메모이제이션

```typescript
// React.memo를 통한 컴포넌트 메모이제이션
const PriceChart = React.memo(({ data, options }) => {
  return <Chart data={data} options={options} />;
});

// useMemo를 통한 계산 결과 메모이제이션
const calculatedSpread = useMemo(() => {
  return calculateSpread(upbitPrice, binancePrice);
}, [upbitPrice, binancePrice]);
```

### 3. 가상화

```typescript
// 대량 데이터 렌더링을 위한 가상화
import { FixedSizeList as List } from 'react-window';

const TradeList = ({ trades }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <TradeItem trade={trades[index]} />
    </div>
  );

  return (
    <List
      height={400}
      itemCount={trades.length}
      itemSize={50}
    >
      {Row}
    </List>
  );
};
```

## 테스트

### 1. 단위 테스트

```typescript
// Jest + React Testing Library
describe('PriceChart', () => {
  it('renders price data correctly', () => {
    const mockData = [
      { timestamp: '2024-01-01', price: 50000 },
      { timestamp: '2024-01-02', price: 51000 }
    ];

    render(<PriceChart data={mockData} />);

    expect(screen.getByText('50000')).toBeInTheDocument();
    expect(screen.getByText('51000')).toBeInTheDocument();
  });
});
```

### 2. 통합 테스트

```typescript
// API 통신 테스트
describe('BacktestAPI', () => {
  it('uploads data successfully', async () => {
    const mockFile = new File(['test'], 'test.csv', { type: 'text/csv' });
    const mockParams = { exchange: 'upbit', symbol: 'BTC' };

    const result = await uploadData(mockFile, mockParams);

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
  });
});
```

## 배포

### 1. 빌드

```bash
# 프로덕션 빌드
npm run build

# 정적 파일 생성
npm run export
```

### 2. 환경 변수

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
NEXT_PUBLIC_ENVIRONMENT=development
```

### 3. Docker 배포

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

## 개발 가이드

### 1. 개발 서버 시작

```bash
cd apps/kim-p-dashboard-fe
npm install
npm run dev
```

### 2. 코드 스타일

```bash
# ESLint 검사
npm run lint

# Prettier 포맷팅
npm run format

# 타입 체크
npm run type-check
```

### 3. 새로운 페이지 추가

1. `pages/` 디렉토리에 새 페이지 파일 생성
2. `components/` 디렉토리에 관련 컴포넌트 생성
3. `hooks/` 디렉토리에 커스텀 훅 생성
4. `types/` 디렉토리에 타입 정의 추가
5. 네비게이션에 새 페이지 링크 추가

## 변경 이력

| 버전  | 날짜       | 변경사항             |
| ----- | ---------- | -------------------- |
| 1.0.0 | 2024-01-01 | 초기 대시보드 구현   |
| 1.1.0 | 2024-01-15 | 백테스팅 기능 추가   |
| 1.2.0 | 2024-02-01 | 실시간 모니터링 추가 |
