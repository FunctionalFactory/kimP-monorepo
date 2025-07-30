# Mission Briefing: Implement Final Business Logic for `kimP-Initiator`

## Overall Goal

- To replace the placeholder/simulation logic in the `kimP-Initiator` application with the actual business logic.
- The goal is to make the application fully functional so that it passes all the unit tests we've already written.

## Current Branch

- Ensure all work is done on the `feature/implement-initiator-logic`.

## Step-by-Step Instructions for AI

### 1. Refactor `OpportunityScannerService`

1.  Open `apps/kim-p-initiator/src/initiator/opportunity-scanner.service.ts`.
2.  Modify the service to listen for price update events from the `RedisSubscriberService`.
3.  Instead of simple placeholder logic, it must now call the real `spreadCalculatorService.calculateSpread()` method from our `@app/kimp-core` library.
4.  This method performs the full 3-stage filtering (fees, volume, slippage).
5.  If `calculateSpread` returns a valid, profitable opportunity, the scanner must call the `tradeExecutorService.initiateArbitrageCycle()` method, passing the opportunity data.

### 2. Refactor `TradeExecutorService`

This is the most critical part. We will implement the real logic that the unit tests were designed to verify.

1.  Open `apps/kim-p-initiator/src/initiator/trade-executor.service.ts`.
2.  Implement the `initiateArbitrageCycle(opportunity)` method.
3.  **Logic Sequence**:
    a. First, call `this.portfolioManagerService.checkAvailableFunds()` to ensure we can trade. If not, log and return.
    b. Next, call `this.arbitrageRecordService.createArbitrageCycle()` and `createTrade()` to generate the new cycle and the initial 'PROFIT' trade record in the database. The cycle status must be set to `AWAITING_REBALANCE`.
    c. **CRITICAL**: Wrap the entire trading execution logic (steps d and e) inside `LoggingService.run({ cycleId: newCycle.id }, async () => { ... })` to ensure all subsequent logs are tagged with the cycle ID.
    d. Call the appropriate strategy service from `@app/kimp-core` (e.g., `this.strategyHighService.handleHighPremiumFlow()`) to execute the real buy-transfer-sell sequence.
    e. If the strategy service throws an error, catch it, use `this.errorHandlerService`, and update the cycle's status to `FAILED`.

## Verification

- After implementation, all existing unit tests for `kimP-Initiator` must pass. Run `yarn test apps/kim-p-initiator`.
- Run the `Feeder` and `Initiator` apps together.
- When a real arbitrage opportunity occurs, the system should now perform the following actions, which can be verified in the logs and the database:
  1.  A new cycle is created in the `arbitrage_cycles` table with `status: 'AWAITING_REBALANCE'`.
  2.  A new trade is created in the `trades` table with `trade_type: 'PROFIT'`.
  3.  All logs related to this process are tagged with the new `[CYCLE:...]` ID.
