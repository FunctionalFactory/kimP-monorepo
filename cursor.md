# Mission Briefing: Phase 1, Step 2 - Core Library Exchange Module

## Overall Goal

- To migrate all exchange-related services, modules, and interfaces from the legacy project into the `kimp-core` library.
- This will centralize all exchange communication logic, making it reusable across all applications.

## Current Branch

- Ensure all work is done on the `feature/core-exchange-module` branch.

## Step-by-Step Instructions for AI

### Step 1: Migrate Core Exchange Interface

1.  Copy the file `apps/kim-p-legacy/src/common/exchange.interface.ts` to a new directory: `packages/kimp-core/src/exchange/`.

### Step 2: Migrate Individual Exchange Modules

1.  Copy the entire `upbit` directory from `apps/kim-p-legacy/src/` to `packages/kimp-core/src/exchange/`.
2.  Copy the entire `binance` directory from `apps/kim-p-legacy/src/` to `packages/kimp-core/src/exchange/`.
3.  Create a `simulation` directory inside `packages/kimp-core/src/exchange/`.
4.  Copy the files `simulation.module.ts` and `simulation-exchange.service.ts` from `apps/kim-p-legacy/src/common/` to the new `packages/kimp-core/src/exchange/simulation/` directory.

### Step 3: Migrate the Facade Service

1.  Copy the `exchange.service.ts` file from `apps/kim-p-legacy/src/common/` to `packages/kimp-core/src/exchange/`.
2.  Review all migrated files (`upbit.service.ts`, `binance.service.ts`, `exchange.service.ts`, etc.) and update any relative import paths (e.g., `../common/exchange.interface`) to point to their new locations within the library.

### Step 4: Assemble the Main ExchangeModule

1.  Create a new file `exchange.module.ts` inside `packages/kimp-core/src/exchange/`.
2.  Inside this new `ExchangeModule`, import `UpbitModule`, `BinanceModule`, and `SimulationModule`.
3.  The module should provide and export the main `ExchangeService`.
4.  Update the main `kimp-core.module.ts` to import and export this new `ExchangeModule`.

## Verification

- After completing all steps, run the build command for the library from the project's root directory.
- The command `yarn build kimp-core` must complete without any errors.
