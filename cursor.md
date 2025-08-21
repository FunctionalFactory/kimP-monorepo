# Mission: [Phase 2] 데이터셋 기반 백테스팅 실행 기능 구현

## 1. 프로젝트 브리핑 (for AI Assistant)

안녕하세요. 당신은 `kimP-monorepo` 프로젝트의 백테스팅 실행 엔진을 구현하는 AI 어시스턴트입니다. Phase 1에서 사용자가 '완제품' CSV 파일을 '데이터셋'으로 업로드하고 관리하는 기능이 성공적으로 구축되었습니다.

당신의 임무는 Phase 1에서 만들어진 이 기반을 활용하여, **사용자가 웹 UI에서 특정 데이터셋과 투자 전략을 선택하면, 시스템이 해당 데이터를 기반으로 완전한 End-to-End 백테스팅을 실행**하도록 만드는 것입니다.

**핵심 설계:**

- **모드 분리**: `.env`의 `APP_MODE=backtest` 설정에 따라, 시스템은 실제 거래소에 접속하지 않고 오직 지정된 CSV 파일 데이터로만 작동해야 합니다.
- **데이터 흐름**: `Dashboard` (사용자) → `Dashboard-BE` (세션 생성) → `Feeder` (데이터 재생) → `Initiator` (거래 결정) → `Finalizer` (결과 기록)

**작업 브랜치**: `main` 브랜치에서 시작하여 `feature/rebuild-backtesting-phase2` 라는 새로운 브랜치를 생성하고, 그곳에서 모든 작업을 진행하세요.

---

## 2. 오늘의 임무: 백테스팅 실행 파이프라인 구축

### Task 1: 백엔드 - 백테스팅 시작 API 고도화

1.  **`BacktestSession` 엔티티 수정**: `packages/kimp-core/src/db/entities/backtest-session.entity.ts` 파일에, 이 세션이 어떤 데이터셋을 사용하는지 연결하기 위한 `datasetId` 컬럼을 추가하세요.

    ```typescript
    // ... 다른 컬럼들 ...
    @Column()
    datasetId: string; // 사용할 BacktestDataset의 ID
    ```

2.  **API 컨트롤러 수정**: `apps/kim-p-dashboard-be/src/backtesting/backtesting.controller.ts`의 세션 생성 API를 수정합니다.
    - 이제 `symbolPairs` 같은 복잡한 정보 대신, `datasetId`와 `totalCapital`, `investmentAmount` 등 간단한 전략 파라미터만 입력받습니다.
    - 요청을 받으면, `BacktestSession` 테이블에 새로운 세션 정보를 기록합니다.
    - **중요**: 세션 정보를 DB에 저장한 후, **`Feeder` 서비스의 '백테스트 플레이어'를 실행하도록 이벤트를 발생시키거나 직접 호출**해야 합니다. (NestJS의 EventEmitter 또는 간단한 HTTP 요청 사용)

### Task 2: 프론트엔드 - 백테스팅 실행 UI 구현

1.  **파일 경로**: `apps/kim-p-dashboard-fe/src/app/backtesting/page.tsx`
2.  **UI 수정**: 페이지의 UI를 아래와 같이 변경하세요.
    - **데이터셋 선택**: `GET /datasets` API를 호출하여, Phase 1에서 업로드한 데이터셋 목록을 가져와 **드롭다운 메뉴**로 표시합니다.
    - **전략 파라미터 입력**: `totalCapital`과 `investmentAmount`를 입력받는 숫자 필드를 추가합니다.
    - **실행 버튼**: "백테스팅 시작" 버튼을 누르면, 선택된 `datasetId`와 입력된 전략 파라미터를 백엔드 API로 전송하여 백테스팅을 시작합니다.

### Task 3: Feeder - '백테스트 플레이어' 서비스 구현

이것이 Phase 2의 핵심입니다. `Feeder`가 `backtest` 모드일 때, CSV 파일을 읽어 시장을 시뮬레이션하는 플레이어 역할을 하도록 만듭니다.

1.  **`BacktestPlayerService` 생성**: `apps/kim-p-feeder/src/backtest-session/backtest-player.service.ts` 파일을 생성하고, `BacktestSessionModule`에 등록하세요.
2.  **플레이어 로직 구현**: `run(sessionId: string)` 메서드를 구현하세요.
    - `sessionId`를 받아 DB에서 `BacktestSession` 정보를 조회합니다.
    - 조회된 정보에서 `datasetId`를 얻어, 다시 DB에서 `BacktestDataset` 정보를 조회하여 **실제 CSV 파일의 경로**를 알아냅니다.
    - 알아낸 경로의 CSV 파일을 한 줄씩 읽으며, 각 줄의 데이터를 `Redis`를 통해 `Initiator`로 전송합니다. (이때 메시지에 `sessionId`를 반드시 포함해야 합니다.)

---

## 3. 완료 보고: `review.md` 파일 작성

모든 작업이 완료되면, 프로젝트 루트의 `review.md` 파일에 아래 형식으로 진행 상황과 결과를 정리하여 보고해주세요.

```markdown
# [Phase 2] 백테스팅 실행 기능 구축 완료 보고

## 1. 구현된 기능

### A. 백엔드 (`kim-p-dashboard-be`)

- **DB 모델**: `BacktestSession` 엔티티에 `datasetId`를 추가하여, 각 테스트가 어떤 데이터를 사용했는지 명확하게 추적하도록 개선함.
- **API**: 백테스팅 시작 API가 `datasetId`와 전략 파라미터를 받아 새로운 세션을 생성하고, `Feeder`의 백테스트 플레이어를 실행시키도록 구현함.

### B. 프론트엔드 (`kim-p-dashboard-fe`)

- **UI/UX**: `/backtesting` 페이지에서 사용자가 업로드된 데이터셋을 선택하고, 총자본과 세션당 투자금을 직접 입력하여 백테스팅을 시작할 수 있도록 UI를 전면 개편함.

### C. Feeder (`kim-p-feeder`)

- **백테스트 플레이어**: `APP_MODE=backtest`일 때만 동작하는 `BacktestPlayerService`를 구현함. 이 서비스는 지정된 CSV 파일을 읽어, 시간 순서대로 시장 데이터를 `Redis`에 발행하여 전체 시뮬레이션을 주도함.
- **모드 분리**: `live` 모드일 때는 플레이어가 동작하지 않도록 하여, 실제 운영과 백테스팅 환경을 완벽하게 분리함.

## 2. 다음 단계

- 데이터 준비(Phase 1)와 실행(Phase 2) 기능이 모두 완성됨.
- 이제 사용자는 웹 UI에서 자신이 업로드한 데이터를 가지고, 원하는 투자 전략으로 시뮬레이션을 실행할 수 있는 완전한 파이프라인을 갖추게 됨.
- 다음 Phase 3에서는 실행된 백테스팅의 **결과를 분석하고 시각화**하는 기능을 구현할 준비가 완료됨.
```
