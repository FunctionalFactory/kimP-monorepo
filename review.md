# Mission: [Phase 3] 백테스팅 결과 분석 및 시각화 대시보드 구축

## 1. 프로젝트 브리핑 (for AI Assistant)

안녕하세요. 당신은 `kimP-monorepo` 프로젝트의 마지막 단계인 '결과 분석 대시보드' 구현을 책임질 AI 어시스턴트입니다. 우리는 Phase 1과 2를 통해, 사용자가 CSV 데이터를 등록하고 원하는 투자 전략으로 백테스팅을 실행하는 완전한 파이프라인을 성공적으로 구축했습니다.

이제 데이터베이스에 차곡차곡 쌓인 백테스팅 결과를 사용자가 한눈에 이해하고, 전략의 성패를 판단할 수 있도록 **결과를 분석하고 시각화하는 '계기판'**을 만들어야 합니다.

**핵심 목표:**

- **백엔드**: 특정 백테스팅 세션의 상세 결과 데이터를 분석하고, 핵심 성과 지표(KPI)를 계산하여 제공하는 API를 개발합니다.
- **프론트엔드**: 위 API에서 받은 데이터를 사용하여, 사용자가 쉽게 이해할 수 있는 차트와 표로 구성된 결과 상세 페이지를 개발합니다.

**작업 브랜치**: `main` 브랜치에서 시작하여 `feature/rebuild-backtesting-phase3` 라는 새로운 브랜치를 생성하고, 그곳에서 모든 작업을 진행하세요.

---

## 2. 오늘의 임무: 결과 대시보드 파이프라인 구축

### Task 1: 백엔드 - 결과 분석 API 개발 (`kim-p-dashboard-be`)

1.  **새로운 결과 분석 서비스 생성**: `apps/kim-p-dashboard-be/src/backtesting/` 경로에 `backtest-result.service.ts` 파일을 새로 만들고, `BacktestingModule`에 등록하세요.

2.  **결과 분석 로직 구현**: `backtest-result.service.ts`에 `analyze(sessionId: string)` 메서드를 구현하세요.
    - `sessionId`를 입력받아, `kimp-core`의 DB 서비스를 이용해 해당 세션에서 발생한 모든 `ArbitrageCycle` 엔티티 목록을 조회합니다.
    - 조회된 데이터를 바탕으로 아래와 같은 **핵심 성과 지표(KPI)**를 계산하는 로직을 작성하세요.
      - `totalProfitLoss`: 총 손익 (모든 `netProfitKrw`의 합계)
      - `totalTrades`: 총 거래 횟수 (조회된 `ArbitrageCycle`의 개수)
      - `winCount`: 수익을 낸 거래의 횟수 (`netProfitKrw > 0`인 경우)
      - `winRate`: 승률 (`winCount / totalTrades * 100`)
      - `averageProfitLoss`: 평균 손익 (`totalProfitLoss / totalTrades`)
      - `initialCapital`: `BacktestSession` 정보에서 초기 자본금 가져오기
      - `totalRoi`: 총수익률 (`totalProfitLoss / initialCapital * 100`)
    - 계산된 KPI와, 상세 거래 내역(모든 `ArbitrageCycle` 목록)을 함께 반환합니다.

3.  **API 엔드포인트 생성**: `backtesting.controller.ts`에 새로운 API 엔드포인트를 추가하세요.
    - **`GET /backtest/sessions/:id/results`**: `id`(sessionId)를 파라미터로 받아, `backtest-result.service.ts`의 `analyze` 메서드를 호출하고 그 결과를 JSON 형태로 반환합니다.

### Task 2: 프론트엔드 - 결과 대시보드 UI 구현 (`kim-p-dashboard-fe`)

1.  **결과 상세 페이지 신설**: `app/results/[sessionId]/page.tsx` 경로에 동적 라우팅을 사용하는 새로운 페이지를 만드세요. (`[sessionId]`는 실제 세션 ID로 채워집니다.)

2.  **데이터 호출 로직**: 페이지가 로드될 때, URL의 `sessionId`를 사용하여 백엔드의 `GET /backtest/sessions/:id/results` API를 호출하고 결과 데이터를 상태(state)에 저장하는 로직을 구현하세요.

3.  **UI 컴포넌트 구현**: API로부터 받은 데이터를 사용하여 아래의 컴포넌트들을 화면에 그리세요.
    - **KPI 요약 카드**: 총수익률, 총 손익, 승률 등 핵심 지표들을 눈에 잘 띄는 카드 형태로 보여줍니다. (Material-UI의 `Card`, `Grid` 컴포넌트 활용)
    - **상세 거래 내역 테이블**: `ArbitrageCycle` 목록을 `DataGrid` 또는 `Table` 컴포넌트를 사용하여 시간순으로 보여줍니다. (각 행에는 시작 시간, 종료 시간, 진입 가격, 청산 가격, 수익률, 순수익 등의 정보 포함)
    - **(고급) 자산 그래프**: `recharts` 또는 `chart.js` 같은 차트 라이브러리를 설치하여, 시간의 흐름에 따라 누적 수익금이 어떻게 변했는지 보여주는 **선 그래프(Line Chart)**를 구현합니다.
      - X축: 거래 시간
      - Y축: 해당 거래까지의 누적 순수익 (`cumulativeProfit`)

---

## 3. 완료 보고: `review.md` 파일 작성

모든 작업이 완료되면, `review.md` 파일에 최종 완료 보고서를 작성해주세요.

```markdown
# [Phase 3] 결과 분석 및 시각화 대시보드 구축 완료 보고

## 1. 구현된 기능

### A. 백엔드 (`kim-p-dashboard-be`)

- **결과 분석 서비스**: 특정 백테스팅 세션의 모든 거래 기록을 바탕으로 총수익률, 승률 등 8가지 이상의 핵심 성과 지표(KPI)를 계산하는 `BacktestResultService`를 구현함.
- **결과 API**: `GET /backtest/sessions/:id/results` 엔드포인트를 통해, 계산된 KPI와 상세 거래 내역을 프론트엔드에 제공하도록 구현함.

### B. 프론트엔드 (`kim-p-dashboard-fe`)

- **결과 상세 페이지**: 동적 라우팅 (`/results/[sessionId]`)을 사용하여 각 백테스팅의 결과를 볼 수 있는 전용 페이지를 생성함.
- **결과 시각화**:
  - **KPI 요약**: 사용자가 전략의 성과를 즉시 파악할 수 있도록 핵심 지표를 카드 형태로 시각화함.
  - **상세 거래 목록**: 모든 거래 내역을 테이블로 제공하여 상세 분석이 가능하도록 함.
  - **자산 그래프**: 시간에 따른 누적 수익 변화를 선 그래프로 시각화하여, 전략의 안정성과 성장성을 직관적으로 파악할 수 있도록 구현함.

## 2. 프로젝트 최종 완료

- 데이터 준비(Phase 1), 실행(Phase 2), 결과 분석(Phase 3)으로 이어지는 백테스팅 시스템의 모든 핵심 기능이 성공적으로 구축됨.
- 이제 사용자는 웹 UI만을 사용하여 **데이터를 등록**하고, **다양한 전략으로 테스트를 실행**하며, 그 **결과를 시각적으로 분석**하는 완전한 '전략 연구' 사이클을 수행할 수 있음.
```
