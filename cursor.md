# Mission Briefing: Unit & Functional Tests for `kimP-Initiator`

## Overall Goal

- To write comprehensive unit tests for the `kimP-Initiator` application, which acts as the system's brain.
- The tests will verify that the application correctly subscribes to Redis data, uses `kimp-core` services to analyze opportunities, and properly initiates an arbitrage cycle in the database.

## Current Branch

- Ensure all work is done on the `test/unit-initiator-app` branch.

## Step-by-Step Instructions for AI

### 1. Set Up Test Environment

1.  Create test files for the key services in `apps/kim-p-initiator/src/initiator/`:
    - `redis-subscriber.service.spec.ts` (if you created this service)
    - `opportunity-scanner.service.spec.ts`
    - `trade-executor.service.spec.ts`
2.  For each test file, use `@nestjs/testing`'s `Test.createTestingModule`.
3.  **Mock ALL `kimp-core` Services**: For these tests, we assume `@app/kimp-core` is working perfectly (as we already tested it). We need to provide mock implementations for all services imported from the core library, such as `SpreadCalculatorService`, `ArbitrageRecordService`, `PortfolioManagerService`, `StrategyHighService`, `LoggingService`, etc.

### 2. Write Unit Test Cases

#### **For `RedisSubscriberService` (or equivalent):**

- Test that the service correctly subscribes to the `TICKER_UPDATES` channel on initialization.
- Test that when a mock Redis client emits a message, the service correctly parses it and emits an internal event for other services to hear.

#### **For `OpportunityScannerService`:**

- Test that when it receives an internal price update event, it calls `spreadCalculatorService.calculateSpread` with the correct arguments.
- **Scenario 1 (Profitable)**: If the mocked `spreadCalculatorService` returns a valid opportunity object, test that the service correctly calls `tradeExecutorService.initiateArbitrageCycle`.
- **Scenario 2 (Not Profitable)**: If the mocked `spreadCalculatorService` returns `null`, test that the `tradeExecutorService` is **NOT** called.

#### **For `TradeExecutorService`:**

- **Scenario 1 (Happy Path)**: When `initiateArbitrageCycle` is called with a valid opportunity:
  - It should first call `portfolioManagerService.checkAvailableFunds`.
  - Then, it should call `arbitrageRecordService.createArbitrageCycle` to create the DB record.
  - Then, it should call the appropriate strategy service (e.g., `strategyHighService.executeTrade`).
  - Verify that `LoggingService.run` is called with the correct `cycleId`.
- **Scenario 2 (Insufficient Funds)**: If the mocked `portfolioManagerService` indicates insufficient funds, test that the service stops execution and does **NOT** call `arbitrageRecordService` or any strategy services.
- **Scenario 3 (DB Error)**: If the mocked `arbitrageRecordService` throws an error, test that the error is handled gracefully and the trade does not proceed.

## Verification

- Run the unit tests for the `kimP-Initiator` application from the project's root directory.
- The command `yarn test apps/kim-p-initiator` must run, and all new tests should pass successfully.
- This will confirm that the "brain" of our system makes correct decisions and interacts properly with our core library.
