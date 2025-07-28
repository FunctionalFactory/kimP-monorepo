# Mission Briefing: Phase 1, Step 1 - Core Library Foundation (DB & Config)

## Overall Goal

- The primary goal is to migrate essential database and configuration logic from the legacy project (`apps/kim-p-legacy`) into our new shared library (`packages/kimp-core`).
- This will establish a stable foundation for all other applications.

## Current Branch

- Ensure all work is done on the `feature/core-database-setup` branch.

## Step-by-Step Instructions for AI

### Step 1: Migrate and Refactor Database Entities

1.  Copy the file `apps/kim-p-legacy/src/db/entities/portfolio-log.entity.ts` to `packages/kimp-core/src/db/entities/`.
2.  Create a new file `packages/kimp-core/src/db/entities/trade.entity.ts`. Based on our new schema design, this entity should include fields like `id`, `cycle_id`, `trade_type`, `symbol`, `status`, `net_profit_krw`, `investment_krw`, and a JSON column named `details`.
3.  Create a new file `packages/kimp-core/src/db/entities/arbitrage-cycle.entity.ts`. Refactor it based on our new schema. It should now be a simple summary table containing `id`, `status`, `initial_trade_id` (FK to Trade), `rebalance_trade_id` (FK to Trade), `total_net_profit_krw`, etc.
4.  Do not migrate `session-fund-validation.entity.ts`. It is deprecated.

### Step 2: Migrate Database Services

1.  Copy the files `arbitrage-record.service.ts` and `portfolio-log.service.ts` from `apps/kim-p-legacy/src/db/` to `packages/kimp-core/src/db/`.
2.  Update the code in `arbitrage-record.service.ts` to work with the new `ArbitrageCycle` and `Trade` entities. It should now manage both tables.
3.  Ensure `portfolio-log.service.ts` correctly uses the `PortfolioLog` entity within the new library structure.

### Step 3: Migrate Configuration Services

1.  Copy the entire `config` directory from `apps/kim-p-legacy/src/` to `packages/kimp-core/src/`.

### Step 4: Assemble the Core Modules

1.  Create a new `database.module.ts` inside `packages/kimp-core/src/db/`.
    - This module should use `TypeOrmModule.forFeature()` to register the `ArbitrageCycle`, `Trade`, and `PortfolioLog` entities.
    - It must provide and export `ArbitrageRecordService` and `PortfolioLogService`.
2.  Ensure that the main module file `packages/kimp-core/src/kimp-core.module.ts` correctly imports and exports the `DatabaseModule` and the `ConfigModule`.

## Verification

- After completing all steps, run the build command for the library from the project's root directory.
- The command `yarn build kimp-core` must complete without any errors.
