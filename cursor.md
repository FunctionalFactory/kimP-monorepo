# Mission Briefing: Phase 2, Step 1 - Implement Database Concurrency Control

## Overall Goal

- To prevent a critical race condition where multiple `kimP-Finalizer` instances could process the same arbitrage cycle simultaneously.
- We will achieve this by implementing a pessimistic lock within a database transaction when fetching a pending cycle.

## Current Branch

- Ensure all work is done on the `feature/db-concurrency-lock` branch.

## Step-by-Step Instructions for AI

### Step 1: Modify `ArbitrageRecordService`

1.  Open the file: `packages/kimp-core/src/db/arbitrage-record.service.ts`.
2.  We need a new method that safely finds the next available cycle and immediately locks it to prevent other processes from accessing it.
3.  Create a new public async method named `findAndLockNextCycle`.

### Step 2: Implement Pessimistic Locking

1.  The `findAndLockNextCycle` method must use TypeORM's `manager.transaction` to ensure the entire operation is atomic.
2.  Inside the transaction, use the query builder to find the oldest cycle with the status `AWAITING_REBALANCE`.
3.  Crucially, apply a pessimistic write lock using `.setLock('pessimistic_write')`. This will lock the selected row until the transaction is complete.
4.  If a cycle is found, immediately update its status to `REBALANCING_IN_PROGRESS` within the same transaction.
5.  Return the locked and updated cycle object. If no cycle is found, return `null`.

### Code Example to Follow:

Please implement the new method in `arbitrage-record.service.ts` similar to the following structure:

```typescript
// packages/kimp-core/src/db/arbitrage-record.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArbitrageCycle, ArbitrageCycleStatus } from './entities/arbitrage-cycle.entity';
import { Trade } from './entities/trade.entity';

@Injectable()
export class ArbitrageRecordService {
  // ... existing constructor and other methods

  public async findAndLockNextCycle(): Promise<ArbitrageCycle | null> {
    return this.arbitrageCycleRepository.manager.transaction(
      async (transactionalEntityManager) => {
        // 1. Find the oldest pending cycle and lock the row for writing
        const cycle = await transactionalEntityManager
          .createQueryBuilder(ArbitrageCycle, 'cycle')
          .setLock('pessimistic_write')
          .where('cycle.status = :status', { status: 'AWAITING_REBALANCE' })
          .orderBy('cycle.created_at', 'ASC')
          .getOne();

        // 2. If no cycle is found, return null
        if (!cycle) {
          return null;
        }

        // 3. Immediately update the status to lock it logically
        cycle.status = 'REBALANCING_IN_PROGRESS';
        await transactionalEntityManager.save(cycle);

        this.logger.log(`Locked and updated cycle ${cycle.id} to REBALANCING_IN_PROGRESS`);

        // 4. Return the locked cycle
        return cycle;
      },
    );
  }

  // ... other methods
}
## Verification

- After the AI completes the task, run `yarn build kimp-core`. It must complete without errors.
```
