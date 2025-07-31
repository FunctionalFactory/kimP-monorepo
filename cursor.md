# Mission Briefing: Implement Full Business Logic for `kimP-Initiator`

## Overall Goal

- To replace all placeholder and simulation logic in the `kimP-Initiator` application with fully functional, production-ready business logic.
- The application must correctly use services from the `@app/kimp-core` library to detect opportunities, manage state, and execute the first leg of an arbitrage trade.

## Current Branch

- Ensure all work is done on the `feature/implement-initiator-logic` branch.

## Step-by-Step Instructions for AI

### 1. Refactor `OpportunityScannerService` for Real Logic

1.  Open `apps/kim-p-initiator/src/initiator/opportunity-scanner.service.ts`.
2.  Ensure it correctly injects `SpreadCalculatorService` from `@app/kimp-core`.
3.  The logic that listens for price updates must call `spreadCalculatorService.calculateSpread()` to perform the full 3-stage filtering (fees, volume, slippage).
4.  If a valid, profitable opportunity is returned, it must call `tradeExecutorService.initiateArbitrageCycle()`, passing the opportunity data.

### 2. Implement `TradeExecutorService` with Real Logic

1.  Open `apps/kim-p-initiator/src/initiator/trade-executor.service.ts`.
2.  Implement the `initiateArbitrageCycle(opportunity)` method with the following sequence:
    a. **Distributed Lock**: Inject `DistributedLockService` from `@app/kimp-core`. Call `acquireLock()` with a unique key (e.g., `lock:${opportunity.symbol}`). If the lock is not acquired, log it and return immediately.
    b. Use a `try...finally` block to ensure `releaseLock()` is always called.
    c. **Inside the `try` block**:
    i. **Check Funds**: Call `portfolioManagerService.getCurrentInvestmentAmount()` to get the investment amount.
    ii. **Create DB Records**: Call `arbitrageRecordService.createArbitrageCycle()` and `createTrade()` to create the initial records. The cycle status must be `AWAITING_REBALANCE`.
    iii. **Set Logging Context**: Wrap the trade execution in `LoggingService.run({ cycleId: newCycle.id }, ...)`.
    iv. **Execute Trade**: Call the actual strategy service (e.g., `strategyHighService.handleHighPremiumFlow()`) to perform the live buy-transfer-sell sequence.
    v. If the trade fails, catch the error, use `errorHandlerService`, and update the cycle status to `FAILED`.

### 3. Externalize All Configurations

1.  Review all services in `kimP-Initiator`. **There must be no hard-coded values** (like `rate = 1300` or `spreadPercent < 0.5`).
2.  All strategic values must be fetched from `InvestmentConfigService`.
3.  All real-time market data (like exchange rates) must be fetched from `ExchangeService`.

### 4. Write Unit Tests for New Logic

1.  Update the existing test files in `apps/kim-p-initiator/` to reflect the new, real logic.
2.  **For `TradeExecutorService.spec.ts`**:
    - Add a test case to verify that `distributedLockService.acquireLock` is called first.
    - Add a test case to verify that `releaseLock` is called even if the trade execution fails.
    - Verify that the actual strategy services (`StrategyHighService`, etc.) are called with the correct arguments.
3.  **For `OpportunityScannerService.spec.ts`**:
    - Verify that `spreadCalculatorService.calculateSpread` is being called correctly.

## Verification

- Run all unit tests for the `kimP-Initiator` application: `yarn test apps/kim-p-initiator`. All tests must pass.
- Run the full system (`Feeder`, `Initiator`).
- When a real opportunity occurs, verify through logs and the database that a live trade sequence is initiated and a cycle record is correctly created with the `AWAITING_REBALANCE` status.# Mission Briefing: Implement Full Business Logic for `kimP-Initiator`

## Overall Goal

- To replace all placeholder and simulation logic in the `kimP-Initiator` application with fully functional, production-ready business logic.
- The application must correctly use services from the `@app/kimp-core` library to detect opportunities, manage state, and execute the first leg of an arbitrage trade.

## Current Branch

- Ensure all work is done on the `feature/implement-initiator-logic` branch.

## Step-by-Step Instructions for AI

### 1. Refactor `OpportunityScannerService` for Real Logic

1.  Open `apps/kim-p-initiator/src/initiator/opportunity-scanner.service.ts`.
2.  Ensure it correctly injects `SpreadCalculatorService` from `@app/kimp-core`.
3.  The logic that listens for price updates must call `spreadCalculatorService.calculateSpread()` to perform the full 3-stage filtering (fees, volume, slippage).
4.  If a valid, profitable opportunity is returned, it must call `tradeExecutorService.initiateArbitrageCycle()`, passing the opportunity data.

### 2. Implement `TradeExecutorService` with Real Logic

1.  Open `apps/kim-p-initiator/src/initiator/trade-executor.service.ts`.
2.  Implement the `initiateArbitrageCycle(opportunity)` method with the following sequence:
    a. **Distributed Lock**: Inject `DistributedLockService` from `@app/kimp-core`. Call `acquireLock()` with a unique key (e.g., `lock:${opportunity.symbol}`). If the lock is not acquired, log it and return immediately.
    b. Use a `try...finally` block to ensure `releaseLock()` is always called.
    c. **Inside the `try` block**:
    i. **Check Funds**: Call `portfolioManagerService.getCurrentInvestmentAmount()` to get the investment amount.
    ii. **Create DB Records**: Call `arbitrageRecordService.createArbitrageCycle()` and `createTrade()` to create the initial records. The cycle status must be `AWAITING_REBALANCE`.
    iii. **Set Logging Context**: Wrap the trade execution in `LoggingService.run({ cycleId: newCycle.id }, ...)`.
    iv. **Execute Trade**: Call the actual strategy service (e.g., `strategyHighService.handleHighPremiumFlow()`) to perform the live buy-transfer-sell sequence.
    v. If the trade fails, catch the error, use `errorHandlerService`, and update the cycle status to `FAILED`.

### 3. Externalize All Configurations

1.  Review all services in `kimP-Initiator`. **There must be no hard-coded values** (like `rate = 1300` or `spreadPercent < 0.5`).
2.  All strategic values must be fetched from `InvestmentConfigService`.
3.  All real-time market data (like exchange rates) must be fetched from `ExchangeService`.

### 4. Write Unit Tests for New Logic

1.  Update the existing test files in `apps/kim-p-initiator/` to reflect the new, real logic.
2.  **For `TradeExecutorService.spec.ts`**:
    - Add a test case to verify that `distributedLockService.acquireLock` is called first.
    - Add a test case to verify that `releaseLock` is called even if the trade execution fails.
    - Verify that the actual strategy services (`StrategyHighService`, etc.) are called with the correct arguments.
3.  **For `OpportunityScannerService.spec.ts`**:
    - Verify that `spreadCalculatorService.calculateSpread` is being called correctly.

## Verification

- Run all unit tests for the `kimP-Initiator` application: `yarn test apps/kim-p-initiator`. All tests must pass.
- Run the full system (`Feeder`, `Initiator`).
- When a real opportunity occurs, verify through logs and the database that a live trade sequence is initiated and a cycle record is correctly created with the `AWAITING_REBALANCE` status.
