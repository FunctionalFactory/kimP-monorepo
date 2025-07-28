# Mission Briefing: Implement Lock Timeout for "Stuck" Cycle Prevention

## Overall Goal

- To resolve the "Stuck" Cycles issue identified in our architecture review.
- We will implement a timeout mechanism so that if a `Finalizer` instance crashes while processing a cycle, the lock is eventually released, allowing another instance to pick up the job.

## Current Branch

- Ensure all work is done on the `feature/db-lock-timeout` branch.

## Step-by-Step Instructions for AI

### Step 1: Update the `ArbitrageCycle` Entity

1.  Open the file: `packages/kimp-core/src/db/entities/arbitrage-cycle.entity.ts`.
2.  Add a new column `lockedAt` to store the timestamp when a lock is acquired. This should be a nullable timestamp.
    ```typescript
    @Column({ type: 'timestamp', nullable: true })
    lockedAt: Date;
    ```

### Step 2: Enhance the `findAndLockNextCycle` Method

1.  Open the file: `packages/kimp-core/src/db/arbitrage-record.service.ts`.
2.  Modify the `findAndLockNextCycle` method to incorporate the timeout logic.
3.  **Before** finding a new cycle, add a query that **resets the status of any timed-out cycles**.
    - An `UPDATE` query should target cycles where the `status` is `REBALANCING_IN_PROGRESS`.
    - The condition should check if `lockedAt` is older than a specific timeout period (e.g., 5 minutes ago).
    - If a cycle is timed-out, its `status` should be reset to `AWAITING_REBALANCE` and `lockedAt` should be set to `null`.
4.  When a cycle is successfully locked, **set the `lockedAt` column to the current timestamp** before saving it.

### Code Example to Follow:

Please refactor the `findAndLockNextCycle` method in `arbitrage-record.service.ts` to match this logic:

```typescript
// packages/kimp-core/src/db/arbitrage-record.service.ts

public async findAndLockNextCycle(): Promise<ArbitrageCycle | null> {
  const LOCK_TIMEOUT_MINUTES = 5;

  return this.arbitrageCycleRepository.manager.transaction(
    async (transactionalEntityManager) => {
      // 1. Reset any cycles that have timed out
      const timeout = new Date(Date.now() - LOCK_TIMEOUT_MINUTES * 60 * 1000);
      await transactionalEntityManager
        .createQueryBuilder()
        .update(ArbitrageCycle)
        .set({
          status: 'AWAITING_REBALANCE',
          lockedAt: null,
          // Optionally, you can add a note to errorDetails here
        })
        .where('status = :status', { status: 'REBALANCING_IN_PROGRESS' })
        .andWhere('lockedAt < :timeout', { timeout })
        .execute();

      // 2. Find the oldest pending cycle and lock the row for writing
      const cycle = await transactionalEntityManager
        .createQueryBuilder(ArbitrageCycle, 'cycle')
        .setLock('pessimistic_write')
        .where('cycle.status = :status', { status: 'AWAITING_REBALANCE' })
        .orderBy('cycle.created_at', 'ASC')
        .getOne();

      // 3. If no cycle is found, return null
      if (!cycle) {
        return null;
      }

      // 4. Update status and set the lock timestamp
      cycle.status = 'REBALANCING_IN_PROGRESS';
      cycle.lockedAt = new Date(); // Set the current time as the lock time
      await transactionalEntityManager.save(cycle);

      this.logger.log(`Locked cycle ${cycle.id} with a ${LOCK_TIMEOUT_MINUTES}-minute timeout.`);

      // 5. Return the locked cycle
      return cycle;
    },
  );
}
```

Verification
After the AI completes the task, run yarn build kimp-core. It must complete without errors.

Review the code to ensure the timeout logic is correctly implemented as requested.
