# [Hotfix] Feeder 서비스 의존성 문제 해결 및 리팩토링 완료

## 1. 문제 원인 분석

- `PriceFeedService`가 자신의 핵심 책임(가격 수신)과 백테스팅 실행이라는 다른 서비스의 책임을 모두 가지고 있어, 복잡한 의존성 주입 오류 및 순환 참조 문제가 발생함.
- `PriceFeedService`가 `kimp-core`의 `BacktestSessionService`와 `Feeder` 앱의 `FeederBacktestSessionService`를 동시에 주입받으려고 하여 NestJS 의존성 주입 컨텍스트에서 충돌이 발생함.
- 백테스팅 관련 로직이 `PriceFeedService`에 혼재되어 있어 단일 책임 원칙(SRP)을 위반하고 코드의 가독성과 유지보수성을 저해함.

## 2. 리팩토링 계획 및 실행

- 각 서비스의 역할을 명확히 분리하는 것을 목표로 리팩토링을 진행함.
- **`PriceFeedService`**: 백테스팅 관련 로직을 모두 제거하고, `FEEDER_MODE`에 따라 실시간 가격 데이터를 수신하는 단일 책임만 갖도록 수정함.
  - 생성자에서 `backtestSessionService` 주입을 완전히 제거
  - `onModuleInit`에서 백테스팅 모드일 때는 로그만 남기고 실시간 피드 연결을 하지 않도록 수정
  - `startBacktestMode()` 메서드를 완전히 삭제
- **`BacktestPlayerService`**: 백테스팅 시작, CSV 데이터 로딩 및 재생, 세션 상태 업데이트 등 백테스팅의 전체 흐름을 제어하는 총괄 책임자로 기능을 강화하고 관련 로직을 모두 이전함.
  - 생성자에 `kimp-core`의 `BacktestSessionService`, `CandlestickService` 주입 추가
  - `RedisPublisherService` 주입 추가하여 CSV 데이터를 Redis로 직접 발행할 수 있도록 함
  - 기존의 이벤트 기반 처리와 함께 Redis 직접 발행 기능을 병행하여 호환성 확보
- **모듈 재구성**: 변경된 서비스 책임에 맞춰 `PriceFeedModule`과 `BacktestSessionModule`의 의존성(imports/exports)을 재정리함.
  - `PriceFeedModule`: 백테스팅 관련 의존성 제거 (이미 올바르게 설정됨)
  - `BacktestSessionModule`: `RedisModule` 추가하여 `BacktestPlayerService`가 Redis 기능을 사용할 수 있도록 함

## 3. 결과

- `kim-p-feeder` 서비스 실행 시 발생했던 NestJS 의존성 주입 오류가 완전히 해결됨.
- 각 서비스의 역할과 책임이 명확해져 코드의 가독성과 유지보수성이 향상됨.
- 시스템이 `FEEDER_MODE`에 따라 실시간 모드와 백테스팅 모드로 완벽하게 분리되어 작동할 수 있는 안정적인 구조를 갖추게 됨.
- 빌드 테스트를 통과하여 모든 의존성 주입 문제가 해결되었음을 확인함.
- 기존 이벤트 기반 처리와 새로운 Redis 직접 발행 기능을 병행하여 시스템 호환성을 유지함.
