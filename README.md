# kimP Monorepo: High-Frequency Arbitrage System

## 🚀 Overview

이 프로젝트는 NestJS Monorepo 아키텍처를 기반으로 구축된 고성능 암호화폐 차익거래 시스템입니다. 시스템은 역할과 책임에 따라 여러 마이크로서비스로 분리되어 있으며, 공유 라이브러리를 통해 코드의 재사용성과 일관성을 극대화합니다.

---

## 🏛️ Architecture

시스템은 3개의 독립적인 애플리케이션과 1개의 공유 코어 라이브러리로 구성됩니다. 이들은 Redis Pub/Sub을 통해 실시간으로 통신하고, 공유 데이터베이스를 통해 상태를 관리합니다.

+--------------------------+ +--------------------------+
| Upbit WebSocket | | Binance WebSocket |
+------------+-------------+ +-------------+------------+
| |
v v
+------------------------------------------------------+
| Project C: kimP-Feeder (App) |
+------------------------------------------------------+
| Publish to Redis ('TICKER_UPDATES')
v
+--------------------------+
| Redis Pub/Sub |
+--------------------------+
| | Subscribe
v v
+--------------------------+ +--------------------------+
| Project A: kimP-Initiator| | Project B: kimP-Finalizer|
| (App, 수익 기회 포착) | | (App, 사이클 마무리) |
+-----------+--------------+ +-----------+--------------+
| |
+------------+--------------+
v
+-----------------------------+
| Shared DB (MySQL) |
+-----------------------------+

### Components

- **`apps/kimP-Feeder`**: 거래소(업비트, 바이낸스)로부터 실시간 시세 데이터를 수신하여 Redis 채널로 발행하는 역할만 수행하는 경량 서비스입니다.
- **`apps/kimP-Initiator`**: Redis로부터 가격 데이터를 구독하여 수익성 있는 차익거래 기회를 포착합니다. 기회가 발견되면 첫 번째 거래를 실행하고, 완료해야 할 작업을 공유 DB에 기록합니다.
- **`apps/kimP-Finalizer`**: 주기적으로 공유 DB를 확인하여 처리 대기 중인 작업을 가져옵니다. 이미 확보된 수익을 바탕으로 가장 효율적인 자산 복귀 거래를 실행하여 전체 사이클을 안전하게 마무리합니다.
- **`packages/kimp-core`**: 모든 애플리케이션이 공유하는 핵심 로직 라이브러리입니다. (DB 엔티티, 거래소 API 연동, 각종 계산 서비스 등)

---

### 🏃‍♂️ How to Run

각 애플리케이션은 독립적으로 실행되어야 합니다. 프로젝트 루트에서 각각의 터미널을 열고 아래 명령어를 실행하세요.

```bash
# 터미널 1: Feeder 실행 (Port 3001)
yarn start:dev kim-p-feeder

# 터미널 2: Initiator 실행 (Port 3002)
yarn start:dev kim-p-initiator

# 터미널 3: Finalizer 실행 (Port 3003)
yarn start:dev kim-p-finalizer
✅ Project Status
Phase 1: Core Library (kimp-core) Setup - COMPLETED

[x] Database & Config Module Migration

[x] Exchange Module Migration

[x] Common Utilities Module Migration

[x] Integration Test Successful


---

### **3. 잠재적 문제 및 고려사항 분석**

지금까지 구축한 아키텍처는 매우 견고하지만, 앞으로 실제 로직을 구현하면서 마주칠 수 있는 몇 가지 잠재적인 문제점들이 있습니다. 미리 인지하고 대비하면 더 완성도 높은 시스템을 만들 수 있습니다.

#### **1. 동시성 문제 (Concurrency Issues)**
* **상황**: 만약 `kimP-Finalizer`를 여러 개 실행하여 확장할 경우, 두 개의 `Finalizer` 인스턴스가 DB에서 **동일한 `AWAITING_REBALANCE` 작업을 동시에** 가져가 처리하려고 시도할 수 있습니다.
* **잠재적 문제**: 동일한 자산 복귀 거래가 중복으로 실행되어 자금 손실을 유발할 수 있습니다.
* **대비책**: `Finalizer`가 작업을 가져갈 때, 데이터베이스 **트랜잭션(Transaction)과 비관적 잠금(Pessimistic Lock)**을 사용하여 "내가 이 작업을 처리 중이니 다른 누구도 건드리지 마"라고 명확하게 표시해야 합니다. TypeORM은 이러한 잠금 기능을 지원합니다.

#### **2. 분산 환경에서의 설정 관리 (Configuration Management)**
* **상황**: 현재는 `.env` 파일 하나로 모든 설정을 관리하지만, 3개의 앱이 각기 다른 서버에서 실행될 경우 설정 관리가 복잡해질 수 있습니다.
* **잠재적 문제**: 각 서버마다 `.env` 파일을 복사하고 동기화하는 것은 번거롭고 실수할 가능성이 높습니다.
* **대비책**: 초기에는 문제가 없지만, 시스템이 더 커지면 **AWS Parameter Store, HashiCorp Vault** 같은 중앙화된 설정 관리 도구를 도입하거나, NestJS의 `ConfigModule`을 활용하여 환경별 설정 파일을 명확하게 분리하는 전략이 필요합니다.

#### **3. 분산 트랜잭션과 에러 처리 (Distributed Transactions & Errors)**
* **상황**: `Initiator`는 성공적으로 첫 거래를 마쳤지만(`PROFIT` 기록), `Finalizer`가 자산 복귀 거래에 계속 실패하여 사이클을 완료하지 못하는 경우가 발생할 수 있습니다.
* **잠재적 문제**: '완료되지 않은' 사이클이 DB에 계속 쌓이고, 자금이 한쪽 거래소에 묶여 전체 자본의 회전율이 떨어지게 됩니다.
* **대비책**:
    * **재시도(Retry)와 데드 레터 큐(Dead Letter Queue)**: `Finalizer`는 일정 횟수 재시도 후에도 실패하면 해당 작업을 '실패' 상태로 변경하고, 실패한 작업 목록을 별도로 관리하여 개발자가 수동으로 개입할 수 있도록 해야 합니다.
    * **보상 트랜잭션(Compensating Transaction)**: 더 정교하게는, `Finalizer`의 실패가 확정되면 `Initiator`가 실행했던 거래를 되돌리는 '보상 거래' 로직(Saga 패턴)을 구현할 수도 있습니다.

#### **4. 통합 로그 추적 (Centralized Logging)**
* **상황**: 하나의 차익거래 사이클에 대한 로그가 `Initiator`와 `Finalizer` 두 앱에 나뉘어 기록됩니다.
* **잠재적 문제**: 문제가 발생했을 때, 특정 사이클(`cycle_id`)이 어떤 과정을 거쳤는지 파악하기 위해 여러 서버의 로그를 일일이 뒤져야 하는 불편함이 있습니다.
* **대비책**: **Winston**과 같은 로깅 라이브러리를 사용하고, **Datadog, Sentry, ELK Stack** 같은 외부 로깅 플랫폼을 도입하여 모든 로그를 한 곳으로 모으는 것이 좋습니다. 이때, 모든 로그 메시지에 `cycle_id`를 포함시켜 특정 사이클의 전체 흐름을 쉽게 필터링하고 추적할 수 있도록 해야 합니다.
```
