# Mission Briefing: Full Architecture Review & Potential Issue Analysis

## Overall Goal

- To conduct a comprehensive review of the entire `kimp-core` library and the overall monorepo structure.
- The objective is to identify any potential architectural weaknesses, logical inconsistencies, or future problems before we start building the application logic.

## Current Branch

- Ensure all work is done on the `review/architecture-and-potential-issues` branch.

## Review Checklist for AI

Please review the entire codebase within `packages/kimp-core/` and answer the following questions in detail.

### 1. Database Concurrency

- **File to Review**: `packages/kimp-core/src/db/arbitrage-record.service.ts`
- **Question**: When we scale the `kimP-Finalizer` app to multiple instances, two instances might try to process the same `AWAITING_REBALANCE` cycle simultaneously. Does the current `arbitrage-record.service.ts` have any mechanism to prevent this race condition? If not, what is the standard solution using TypeORM's transaction and locking features (e.g., pessimistic locking)? Please provide a code example of how to implement a `findAndLockNextCycle` method.

### 2. Configuration & Environment Variables

- **Files to Review**: `.env.example`, `packages/kimp-core/src/config/investment-config.service.ts`, `apps/**/src/main.ts`
- **Question**: Currently, all apps will share the root `.env` file. What problems could arise from this? For example, how do we manage different database connections for testing vs. production? What is the best practice for managing environment variables in a NestJS monorepo with multiple apps? Should each app have its own `.env` file?

### 3. Distributed Error Handling & State Consistency

- **File to Review**: `packages/kimp-core/src/db/entities/arbitrage-cycle.entity.ts`, `packages/kimp-core/src/utils/handler/error-handler.service.ts`
- **Question**: Consider a scenario where the `Initiator` successfully completes its trade, but the `Finalizer` repeatedly fails to complete the rebalance trade. The `arbitrage_cycle` status would be stuck in `REBALANCING_IN_PROGRESS`. How should we handle this? Should we add a `retry_count` column to the `arbitrage_cycles` table? What is the concept of a "Dead Letter Queue" in this context and how would we implement a simplified version?

### 4. Centralized Logging and Tracing

- **Files to Review**: All services that use `@nestjs/common`'s `Logger`.
- **Question**: Logs for a single arbitrage cycle will be spread across `kimP-Initiator` and `kimP-Finalizer`. How can we trace the entire lifecycle of a single trade using its `cycle_id`? What changes are needed in our `logging.service.ts` to ensure every log message related to a cycle automatically includes the `cycle_id` for easy filtering and debugging in a real production environment (like Datadog or Sentry)? Explain the concept of Correlation ID (in this case, `cycle_id`) in logging.

### 5. Dependency Management

- **File to Review**: Root `package.json` and `packages/kimp-core/package.json`
- **Question**: All dependencies are currently in the root `package.json`. Is this the correct approach for a monorepo? Explain the concept of workspace dependencies and how it could improve our project structure. For instance, should `axios` be a dependency of `kimp-core` instead of the root?
