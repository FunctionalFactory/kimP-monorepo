# Mission Briefing: Phase 1, Step 3 - Finalize Core Library (Utility Modules)

## Overall Goal

- To migrate all remaining common utility services from the legacy project (`apps/kim-p-legacy/src/common/`) into the `kimp-core` library.
- This will complete the `kimp-core` library, making it a fully self-contained package with all shared logic.

## Current Branch

- Ensure all work is done on the `feature/core-utils-module` branch.

## Step-by-Step Instructions for AI

### Step 1: Create a Structured `utils` Directory

1.  Inside `packages/kimp-core/src/`, create a new top-level directory named `utils`.
2.  Inside `utils`, create the following subdirectories for better organization: `calculator`, `external`, `handler`, `service`.

### Step 2: Migrate Utility Services

1.  Move the following files from `apps/kim-p-legacy/src/common/` to `packages/kimp-core/src/utils/calculator/`:
    - `fee-calculator.service.ts`
    - `slippage-calculator.service.ts`
2.  Move the following file from `apps/kim-p-legacy/src/common/` to `packages/kimp-core/src/utils/external/`:
    - `telegram.service.ts`
3.  Move the following files from `apps/kim-p-legacy/src/common/` to `packages/kimp-core/src/utils/handler/`:
    - `error-handler.service.ts`
    - `logging.service.ts`
4.  Move the following files from `apps/kim-p-legacy/src/common/` to `packages/kimp-core/src/utils/service/`:
    - `withdrawal-constraint.service.ts`
    - `portfolio-manager.service.ts`

### Step 3: Assemble the `UtilsModule`

1.  Create a new file `utils.module.ts` inside `packages/kimp-core/src/utils/`.
2.  Inside this new `UtilsModule`, provide and export all the services that were just moved (e.g., `FeeCalculatorService`, `TelegramService`, `PortfolioManagerService`, etc.).
3.  Note: `PortfolioManagerService` depends on `PortfolioLogService` and `InvestmentConfigService`. Ensure these dependencies are correctly handled within the `UtilsModule` by importing `DatabaseModule` and `ConfigModule`.

### Step 4: Update the Main `KimpCoreModule`

1.  Open `packages/kimp-core/src/kimp-core.module.ts`.
2.  Import and export the newly created `UtilsModule`.
3.  Update the `index.ts` file in `packages/kimp-core/src/` to export all new services and modules from the `utils` directory.

## Verification

- After completing all steps, run the build command for the library from the project's root directory.
- The command `yarn build kimp-core` must complete without any errors.
