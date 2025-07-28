# Mission Briefing: Implement Centralized Logging with Correlation ID

## Overall Goal

- To enhance our logging system to automatically include a `cycle_id` in all log messages related to a specific arbitrage cycle.
- This will allow us to easily trace the entire lifecycle of a single transaction across our distributed services (`Initiator` and `Finalizer`).

## Current Branch

- Ensure all work is done on the `feature/centralized-logging` branch.

## Step-by-Step Instructions for AI

### Step 1: Enhance `LoggingService` with `AsyncLocalStorage`

1.  Open the file: `packages/kimp-core/src/utils/handler/logging.service.ts`.
2.  Import `AsyncLocalStorage` from the `async_hooks` built-in Node.js module.
3.  Create a `static` private property `asyncLocalStorage` inside the `LoggingService`. This will store the context for a specific asynchronous operation.
4.  Create a `static` public method `run(context, callback)` that will be used to establish a new asynchronous context.
5.  Modify the `formatMessage` method to automatically retrieve the `cycleId` from `asyncLocalStorage` and prepend it to the log message if it exists.

### Step 2: Create a NestJS Middleware for Context Setting

1.  Create a new file `logging.middleware.ts` inside `packages/kimp-core/src/utils/middleware/`.
2.  Implement a NestJS `Middleware` that extracts a `cycle-id` from the incoming HTTP request headers (or body).
3.  Use the `LoggingService.run()` method to wrap the request processing, setting the extracted `cycle_id` into the `AsyncLocalStorage` context. This will make the `cycle_id` available to all services called during that request.

### Step 3: Implement Context Propagation in Services

1.  **For `kimP-Initiator`**: When a new arbitrage opportunity is detected and a new cycle is created, the `Initiator` must start the logging context.
    - In `trade-executor.service.ts`, before executing the trade, wrap the entire logic within `LoggingService.run({ cycleId: newCycle.id }, async () => { ... })`.
2.  **For `kimP-Finalizer`**: When the scheduler picks up a pending cycle, the `Finalizer` must also start the logging context.
    - In `cycle-finder.service.ts` (or the scheduler itself), when a cycle is fetched from the DB to be processed, wrap the processing logic within `LoggingService.run({ cycleId: cycle.id }, async () => { ... })`.

### Code Example to Follow for `LoggingService`:

```typescript
// packages/kimp-core/src/utils/handler/logging.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface LoggingContext {
  cycleId?: string;
  // other context properties can be added here
}

@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);
  private static asyncLocalStorage = new AsyncLocalStorage<LoggingContext>();

  public static run<T>(context: LoggingContext, callback: () => T): T {
    return this.asyncLocalStorage.run(context, callback);
  }

  private formatMessage(level: string, message: string): string {
    const context = LoggingService.asyncLocalStorage.getStore();
    const cycleId = context?.cycleId;
    const correlationId = cycleId ? `[CYCLE:${cycleId}]` : '';

    return `${correlationId} [${level}] ${message}`;
  }

  log(message: string) {
    this.logger.log(this.formatMessage('INFO', message));
  }
  // Implement other methods like error, warn, debug similarly
}

Verification
After implementation, run the applications.

When Initiator creates a new cycle, all subsequent logs related to that cycle (even from different services) should be prefixed with [CYCLE:...].

When Finalizer processes a cycle, its logs should also be prefixed with the correct [CYCLE:...] ID.
```
