# Mission: [Hotfix] `Feeder` 서비스의 의존성 주입 오류 해결

## 1. 프로젝트 브리핑 (for New AI Assistant)

안녕하세요. 당신은 `kimP-monorepo` 프로젝트의 긴급 오류 수정을 담당할 AI 어시스턴트입니다. 현재 `kim-p-feeder` 애플리케이션 실행 시, NestJS의 의존성 주입(Dependency Injection) 문제로 인해 애플리케이션이 시작되지 못하는 심각한 오류가 발생하고 있습니다.

당신의 임무는 이 오류의 근본 원인을 파악하고, 아키텍처 원칙에 맞게 코드를 리팩토링하여 문제를 해결하는 것입니다.

---

## 2. 오류 분석 (Root Cause Analysis)

**오류 메시지:**
`Nest can't resolve dependencies of the PriceFeedService (...). Please make sure that the argument FeederBacktestSessionService at index [5] is available in the PriceFeedModule context.`

**분석:**

1.  **`PriceFeedService`**는 생성자(constructor)를 통해 **`FeederBacktestSessionService`**라는 서비스를 주입받으려고 합니다.
2.  이 `FeederBacktestSessionService`는 `Feeder` 앱 내(`apps/kim-p-feeder/src/backtest-session/`)에 위치하며, 백테스팅의 상태 관리와 같은 복잡한 애플리케이션 로직을 담고 있습니다.
3.  반면, `kimp-core` 패키지에는 데이터베이스와 직접 통신하는 순수한 DB 관리용 **`BacktestSessionService`**가 존재합니다.
4.  최근 리팩토링으로 인해 `PriceFeedService`가 `kimp-core`의 `BacktestSessionService`를 직접 주입받도록 변경되었으나, `PriceFeedService` 내부에 남아있는 `startBacktestMode` 메서드는 여전히 `Feeder` 앱 전용 로직(`initializeSession` 등)을 호출하고 있어 타입 오류가 발생합니다.

**결론**: 문제의 근본 원인은 **역할과 책임의 분리가 무너진 것**입니다. `PriceFeedService`가 자신의 핵심 책임(실시간 가격 데이터 수신)을 넘어, 백테스팅 실행이라는 다른 서비스의 책임을 침범하고 있기 때문에 복잡한 의존성 문제가 발생했습니다.

---

## 3. 해결 계획 (Refactoring Plan)

오류를 해결하고 더 나은 구조를 만들기 위해, 각 서비스의 역할을 명확히 재정의하고 코드를 그에 맞게 재배치합니다.

- **`PriceFeedService`**: 오직 **실시간 가격 데이터를 수신**하는 책임만 맡습니다. 백테스팅 실행 관련 코드는 모두 제거합니다.
- **`BacktestPlayerService`**: 백테스팅 모드일 때 **CSV 데이터를 읽고, 백테스팅의 전체 흐름을 제어**하는 모든 책임을 맡습니다.

---

## 4. 작업 지침 (Instructions)

### Task 1: `PriceFeedService` 역할 단순화

`PriceFeedService`에서 백테스팅 관련 로직을 완전히 분리하여 순수한 '가격 정보 제공자'로 만듭니다.

1.  **파일 경로**: `apps/kim-p-feeder/src/price-feed/price-feed.service.ts`
2.  **수정 내용**:
    - 생성자(constructor)에서 `backtestSessionService` 주입을 **완전히 제거**하세요.
    - `onModuleInit` 메서드를 수정하여, `APP_MODE`가 `backtest`일 때는 아무 동작도 하지 않고 로그만 남기도록 변경하세요. 실시간 피드 연결 로직은 `live` 모드일 때만 실행되어야 합니다.
    - 파일 하단에 있는 `startBacktestMode()` 메서드 **전체를 삭제**하세요. 이 로직은 `BacktestPlayerService`로 이전될 것입니다.

### Task 2: `BacktestPlayerService` 기능 강화

`BacktestPlayerService`가 백테스팅의 총괄 책임자가 되도록, `PriceFeedService`에서 제거된 로직을 가져와 재구현합니다.

1.  **파일 경로**: `apps/kim-p-feeder/src/backtest-session/backtest-player.service.ts`
2.  **수정 내용**:
    - 생성자(constructor)에 `kimp-core`의 **`BacktestSessionService`**와 **`CandlestickService`**를 주입받도록 추가하세요. 이 서비스들은 DB와 직접 통신하는 데 사용됩니다.
    - 백테스팅을 시작하고 전체 과정을 관리하는 `run(sessionId: string)` 메서드를 구현하세요. 이 메서드는 다음의 로직을 포함해야 합니다.
      1.  `sessionId`를 사용하여 DB에서 세션 정보를 조회합니다.
      2.  세션의 상태를 'RUNNING'으로 업데이트합니다 (`backtestSessionService.updateStartTime`).
      3.  세션 정보에 포함된 `datasetId`를 이용해, 해당 데이터셋의 CSV 파일 경로를 찾습니다.
      4.  CSV 파일을 읽고, 한 줄씩 순회하며 `Redis`로 가격 정보를 발행합니다.
      5.  모든 데이터 처리가 끝나면, 세션의 상태를 'COMPLETED'로 업데이트합니다 (`backtestSessionService.updateResults`).
      6.  만약 과정 중에 오류가 발생하면, 세션 상태를 'FAILED'로 업데이트합니다 (`backtestSessionService.markAsFailed`).

### Task 3: 모듈 의존성 정리

서비스들의 역할이 변경되었으므로, NestJS 모듈 파일(`*.module.ts`)의 의존성을 다시 정리하여 오류가 발생하지 않도록 합니다.

1.  **`PriceFeedModule`**: `BacktestSessionModule`에 대한 의존성이 사라졌으므로, `imports` 배열에서 `BacktestSessionModule`을 **제거**하세요.
2.  **`BacktestSessionModule`**: 이 모듈은 이제 `kimp-core`의 `DatabaseModule`을 `import`하여 `BacktestPlayerService`가 `BacktestSessionService` 등을 사용할 수 있도록 해야 합니다.

---

## 5. 완료 보고: `review.md` 파일 작성

모든 리팩토링 작업이 완료되면, 프로젝트 루트의 `review.md` 파일에 아래 형식으로 변경된 내용을 정리하여 보고해주세요.

```markdown
# [Hotfix] Feeder 서비스 의존성 문제 해결 및 리팩토링 완료

## 1. 문제 원인 분석

- `PriceFeedService`가 자신의 핵심 책임(가격 수신)과 백테스팅 실행이라는 다른 서비스의 책임을 모두 가지고 있어, 복잡한 의존성 주입 오류 및 순환 참조 문제가 발생함.

## 2. 리팩토링 계획 및 실행

- 각 서비스의 역할을 명확히 분리하는 것을 목표로 리팩토링을 진행함.
- **`PriceFeedService`**: 백테스팅 관련 로직을 모두 제거하고, `APP_MODE`에 따라 실시간 가격 데이터를 수신하는 단일 책임만 갖도록 수정함.
- **`BacktestPlayerService`**: 백테스팅 시작, CSV 데이터 로딩 및 재생, 세션 상태 업데이트 등 백테스팅의 전체 흐름을 제어하는 총괄 책임자로 기능을 강화하고 관련 로직을 모두 이전함.
- **모듈 재구성**: 변경된 서비스 책임에 맞춰 `PriceFeedModule`과 `BacktestSessionModule`의 의존성(imports/exports)을 재정리함.

## 3. 결과

- `kim-p-feeder` 서비스 실행 시 발생했던 NestJS 의존성 주입 오류가 완전히 해결됨.
- 각 서비스의 역할과 책임이 명확해져 코드의 가독성과 유지보수성이 향상됨.
- 시스템이 `APP_MODE`에 따라 실시간 모드와 백테스팅 모드로 완벽하게 분리되어 작동할 수 있는 안정적인 구조를 갖추게 됨.
```
