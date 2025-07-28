# Mission Briefing: Phase 1 Final Review - `kimp-core` Library Integration Test

## Overall Goal

- To verify that the newly created `kimp-core` library and all its modules (`DatabaseModule`, `ExchangeModule`, `UtilsModule`, etc.) can be successfully imported and used by a host application (`kimP-Initiator`) within the monorepo.
- This test will confirm that all dependencies are correctly resolved and the library is ready for production use.

## Current Branch

- Ensure all work is done on the `test/core-library-integration` branch.

## Step-by-Step Instructions for AI

### Step 1: Prepare the Testbed Application

1.  We will use `kimP-Initiator` as our testbed.
2.  Open its main module file: `apps/kim-p-initiator/src/kim-p-initiator.module.ts`.

### Step 2: Import the Core Library

1.  In `kim-p-initiator.module.ts`, add `KimpCoreModule` from `@app/kimp-core` to the `imports` array. This is the primary integration step.

### Step 3: Create a Test Injection Service

1.  Using the Nest CLI, generate a new service named `test-injection` inside the `kimP-Initiator` application.
    ```bash
    nest generate service initiator/test-injection --project=kim-p-initiator
    ```
2.  This will create `apps/kim-p-initiator/src/initiator/test-injection.service.ts`.

### Step 4: Inject All Major Core Services

1.  Open the newly created `test-injection.service.ts`.
2.  In its `constructor`, inject all the major public services from our `kimp-core` library. This is the crucial test to see if NestJS's Dependency Injection can resolve everything.

    **Example Constructor:**

    ```typescript
    import { Injectable, Logger } from '@nestjs/common';
    import {
      ExchangeService,
      ArbitrageRecordService,
      PortfolioManagerService,
      InvestmentConfigService,
      TelegramService,
      FeeCalculatorService,
    } from '@app/kimp-core';

    @Injectable()
    export class TestInjectionService {
      private readonly logger = new Logger(TestInjectionService.name);

      constructor(
        private readonly exchangeService: ExchangeService,
        private readonly arbitrageRecordService: ArbitrageRecordService,
        private readonly portfolioManagerService: PortfolioManagerService,
        private readonly investmentConfigService: InvestmentConfigService,
        private readonly telegramService: TelegramService,
        private readonly feeCalculatorService: FeeCalculatorService,
      ) {
        this.logger.log('All core services have been successfully injected!');
      }
    }
    ```

### Step 5: Provide the Test Service

1.  Go back to `apps/kim-p-initiator/src/kim-p-initiator.module.ts`.
2.  Add the new `TestInjectionService` to the `providers` array of the `KimPInitiatorModule`.

## Verification

- **Primary Goal**: The `kimP-Initiator` application must start without any errors.
- **Build Test**: Run `yarn build kim-p-initiator`. It must complete without errors.
- **Runtime Test**: Run `yarn start:dev kim-p-initiator`.
- **Success Condition**: The application must start successfully, and you should see the log message "All core services have been successfully injected!" in the console. This proves that the library is fully functional and integrated.
