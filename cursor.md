# Mission Briefing: Final Phase - Build the `kimP-Finalizer` Application

## Overall Goal

- To build the `kimP-Finalizer` application, the final microservice that completes our automated arbitrage system.
- This application will act as a robust "worker" that safely processes pending arbitrage cycles, handles failures gracefully, and finalizes trades.

## Current Branch

- Ensure all work is done on the `feature/build-finalizer-app` branch.

## Step-by-Step Instructions for AI

### 1. Create the Scheduler

1.  In `apps/kim-p-finalizer/src/`, create a `scheduler` directory with a `SchedulerModule` and `CycleSchedulerService`.
2.  The `CycleSchedulerService` should have a cron job (`@Cron()`) that runs at a regular interval (e.g., every 15 seconds).
3.  This cron job's task is to call a processing method in a new `FinalizerService`.

### 2. Implement the Core `FinalizerService`

1.  In `apps/kim-p-finalizer/src/`, create a `finalizer` directory with a `FinalizerModule` and `FinalizerService`.
2.  The `CycleSchedulerService` should inject and call a public method in `FinalizerService`, for example, `processPendingCycles()`.

### 3. Implement the Cycle Processing Logic in `FinalizerService`

This is the most critical part. The `processPendingCycles` method must implement the following logic:

1.  Use a `while(true)` loop to continuously process jobs until none are left in the queue.
2.  Inside the loop, call `this.arbitrageRecordService.findAndLockNextCycle()` from `@app/kimp-core`. This is **essential** for concurrency safety.
3.  If `findAndLockNextCycle()` returns `null`, it means there are no pending jobs, so `break` the loop.
4.  If a `cycle` object is returned, wrap the entire subsequent logic for this cycle in `LoggingService.run({ cycleId: cycle.id }, async () => { ... })` for tracing.
5.  **Inside the `LoggingService.run` block**:
    a. **Plan the rebalance**: Fetch the initial trade's details (`cycle.initial_trade_id`) to get the profit, which serves as the "allowed loss budget".
    b. **Execute the rebalance**: Find the most cost-effective coin and execute the rebalancing trade using the appropriate `Strategy...Service`.
    c. **Handle Success**: If the trade is successful, create the `REBALANCE` trade record and update the cycle's status to `COMPLETED`. Then, call `portfolioLogService` to log the new portfolio total.
    d. **Handle Failure**: If the trade fails, call `this.retryManagerService.handleCycleFailure(cycle, error)` from `@app/kimp-core`. This will automatically handle the retry count and move the cycle to `DEAD_LETTER` if necessary.

### 4. Assemble the Application

1.  Open `apps/kim-p-finalizer/src/kim-p-finalizer.module.ts`.
2.  Import `KimpCoreModule` to access all shared services.
3.  Import `ScheduleModule.forRoot()` from `@nestjs/schedule`.
4.  Import the local `SchedulerModule` and `FinalizerModule`.

## Verification

- Start all three applications: `Feeder`, `Initiator`, and `Finalizer`.
- **Test Scenario**: Wait for the `Initiator` to detect an opportunity and create a new cycle in the database with the status `AWAITING_REBALANCE`.
- **Expected Outcome**:
  1.  The `Finalizer`'s logs should show that its scheduler has found the new cycle.
  2.  It should log that it has locked the cycle for processing.
  3.  It should execute the rebalancing logic and complete the cycle.
  4.  The `arbitrage_cycles` table in the database should show the final status as `COMPLETED`.
