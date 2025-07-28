# Mission Briefing: Implement Retry and Dead Letter Queue for Error Handling

## Overall Goal

- To make the system resilient against temporary, recoverable errors (e.g., exchange API errors, network issues).
- We will implement a retry mechanism with exponential backoff for failed cycles.
- Cycles that fail repeatedly will be moved to a "Dead Letter Queue" for manual inspection.

## Current Branch

- Ensure all work is done on the `feature/error-handling-retry` branch.

## Step-by-Step Instructions for AI

### Step 1: Enhance the `ArbitrageCycle` Entity

1.  Open `packages/kimp-core/src/db/entities/arbitrage-cycle.entity.ts`.
2.  Add the following new columns to the entity to track retry state:
    - `retryCount` (type: `int`, default: 0)
    - `lastRetryAt` (type: `timestamp`, nullable: true)
    - `failureReason` (type: `text`, nullable: true)
3.  Add new statuses to the `ArbitrageCycleStatus` type: `'AWAITING_RETRY'` and `'DEAD_LETTER'`.

### Step 2: Create a New `RetryManagerService`

1.  Create a new file `retry-manager.service.ts` inside `packages/kimp-core/src/utils/service/`.
2.  Create a new `RetryManagerService` class inside this file.
3.  This service should be provided by the `UtilsModule`.
4.  Implement a public method `handleCycleFailure(cycle: ArbitrageCycle, error: Error)`.

### Step 3: Implement the Failure Handling Logic

1.  Inside the `handleCycleFailure` method, implement the following logic:
    - Increment the `cycle.retryCount`.
    - Set the `cycle.failureReason` to the new error message.
    - Set `cycle.lastRetryAt` to the current timestamp.
    - Define a `MAX_RETRIES` constant (e.g., 5).
    - **If `cycle.retryCount` >= `MAX_RETRIES`:**
      - Set the `cycle.status` to `'DEAD_LETTER'`.
      - Log a critical error indicating that the cycle has been moved to the dead letter queue.
      - (Optional but recommended) Use `TelegramService` to send an alert to the administrator.
    - **Else (if retries are remaining):**
      - Set the `cycle.status` to `'AWAITING_RETRY'`.
      - Calculate the next retry time using exponential backoff (e.g., delay = `10 * (2 ** cycle.retryCount)` minutes).
      - You will need to create a `nextRetryAt` column in the entity for this.
    - Save the updated cycle entity to the database using `ArbitrageRecordService`.

### Step 4: Create a Scheduler to Process Retries

1.  This logic should be placed in the `kimP-Finalizer` application.
2.  In `apps/kim-p-finalizer/src/scheduler/cycle.scheduler.ts`, add a new cron job that runs every minute.
3.  This cron job will call a new method in `RetryManagerService` (e.g., `processPendingRetries`).
4.  The `processPendingRetries` method will query the database for cycles where `status` is `'AWAITING_RETRY'` and `nextRetryAt` is in the past.
5.  For each found cycle, it should change its status back to `AWAITING_REBALANCE` so that the main `Finalizer` logic can pick it up and try again.

## Verification

- After the AI completes the task, run `yarn build kimp-core` and `yarn build kim-p-finalizer`. They must complete without errors.
- Review the code to ensure the retry and dead letter logic is implemented correctly in the new service and entity.
