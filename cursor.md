# Mission Briefing: Make `kimP-Initiator` Production-Ready

## Overall Goal

- To refactor the `kimP-Initiator` application to resolve critical issues identified in the architecture review.
- We will externalize all hard-coded configuration values and implement a robust distributed locking mechanism to support multi-instance scaling.

## Current Branch

- Ensure all work is done on the `feature/initiator-production-ready` branch.

## Step-by-Step Instructions for AI

### Part 1: Externalize Hard-Coded Configurations

1.  **Analyze `OpportunityScannerService`**: Open `apps/kim-p-initiator/src/initiator/opportunity-scanner.service.ts`. It currently contains hard-coded values for spread percentage, investment amount, and exchange rates.
2.  **Integrate `InvestmentConfigService`**:
    - Inject `InvestmentConfigService` from `@app/kimp-core` into the `OpportunityScannerService`.
    - Replace all hard-coded values with calls to this service. For example, `spreadPercent < 0.5` should become `spreadPercent < config.minSpreadPercent`.
    - The investment amount should be fetched using `portfolioManagerService.getCurrentInvestmentAmount()`.
    - The exchange rate must be fetched from `exchangeService.getUSDTtoKRW()`.
3.  **Update `kimp-core`**:
    - Add any new required configuration fields (like `minSpreadPercent`) to `InvestmentConfigService` in `packages/kimp-core/`.
    - Update the root `.env.example` file with these new variables.

### Part 2: Implement Distributed Locking

1.  **Create `DistributedLockService`**: In `packages/kimp-core/src/utils/service/`, create a new `distributed-lock.service.ts` and its corresponding module. This service will use Redis (`ioredis`) to implement a distributed lock. It should have two methods:
    - `acquireLock(key: string, ttl: number): Promise<boolean>`: Uses `redis.set(key, 'locked', 'PX', ttl, 'NX')` to acquire a lock. Returns `true` on success.
    - `releaseLock(key: string): Promise<void>`: Deletes the key from Redis.
2.  **Integrate Lock into `TradeExecutorService`**:
    - Open `apps/kim-p-initiator/src/initiator/trade-executor.service.ts`.
    - Inject the new `DistributedLockService`.
    - At the beginning of the `initiateArbitrageCycle` method, call `acquireLock` with a unique key for the opportunity (e.g., `lock:${opportunity.symbol}`).
    - If the lock is **not** acquired, log it and immediately `return` to prevent duplicate processing.
    - Use a `try...finally` block to ensure `releaseLock` is **always** called at the end of the method, whether the trade succeeds or fails. This is critical to prevent permanent locks.

## Verification

- All existing unit tests for `kimP-Initiator` must still pass.
- Create new unit tests for the `DistributedLockService` in `kimp-core`.
- **Manual Test**:
  1.  Run the `Feeder` and `Initiator`.
  2.  Check the logs to confirm that configuration values are being loaded from the config service, not hard-coded.
  3.  When an opportunity is found, check Redis (using `redis-cli`) to see if a lock key (e.g., `lock:XRP`) is created with a TTL.
  4.  Verify that the lock key is deleted after the trade logic completes.
