# Mission Briefing: Unit Tests for `kimP-Finalizer` Application

## Overall Goal

- To write comprehensive unit tests for the `kimP-Finalizer` application before implementing its final business logic.
- The tests will define the expected behavior for processing and completing arbitrage cycles, ensuring the implementation will be robust and correct.

## Current Branch

- Ensure all work is done on the `test/unit-finalizer-app` branch.

## Step-by-Step Instructions for AI

### 1. Set Up Test Environment

1.  Create a test file: `apps/kim-p-finalizer/src/finalizer/finalizer.service.spec.ts`.
2.  Use `@nestjs/testing`'s `Test.createTestingModule` to set up the environment.
3.  **Mock ALL `kimp-core` Services**: We need to mock all services that `FinalizerService` will depend on, including `ArbitrageRecordService`, `RetryManagerService`, `PortfolioLogService`, `SpreadCalculatorService`, and the strategy services.

### 2. Write Unit Test Cases for `FinalizerService`

Write Jest test cases (`it(...)`) for the `processPendingCycles` method with the following scenarios:

- **Scenario 1 (Happy Path - Cycle Completion)**:
  - Mock `arbitrageRecordService.findAndLockNextCycle` to return a sample cycle.
  - Mock the rebalance planning logic to return a profitable rebalancing option.
  - Mock the strategy service (`StrategyLowService`, etc.) to return a successful trade result.
  - **Verify** that `arbitrageRecordService.updateArbitrageCycle` is called to set the final status to `COMPLETED`.
  - **Verify** that `portfolioLogService.createLog` is called to record the new portfolio balance.

- **Scenario 2 (No Pending Cycles)**:
  - Mock `arbitrageRecordService.findAndLockNextCycle` to return `null`.
  - **Verify** that the service does not perform any other actions and exits gracefully.

- **Scenario 3 (Trade Execution Fails)**:
  - Mock `arbitrageRecordService.findAndLockNextCycle` to return a sample cycle.
  - Mock the strategy service to throw an error during trade execution.
  - **Verify** that `retryManagerService.handleCycleFailure` is called with the correct cycle and error information.
  - **Verify** that the cycle status is NOT set to `COMPLETED`.

- **Scenario 4 (No Profitable Rebalance Option)**:
  - Mock `arbitrageRecordService.findAndLockNextCycle` to return a sample cycle.
  - Mock the rebalance planning logic to find no suitable (cost-effective) rebalancing options.
  - **Verify** that the service handles this case gracefully (e.g., logs a warning and potentially calls `retryManagerService` to try again later).

## Verification

- Run the unit tests for the `kimP-Finalizer` application from the project's root directory.
- The command `yarn test apps/kim-p-finalizer` must run, and all new tests should pass successfully.
- This will provide a clear, test-driven specification for implementing the final business logic.
