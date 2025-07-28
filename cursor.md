# Mission Briefing: Phase 3 - Build the `kimP-Initiator` Application

## Overall Goal

- To build the `kimP-Initiator` application, which acts as the "brain" of the arbitrage system.
- It will subscribe to real-time price data from Redis, detect profitable opportunities, execute the initial trade, and create a new arbitrage cycle record in the database for the `Finalizer` to complete.

## Current Branch

- Ensure all work is done on the `feature/build-initiator-app` branch.

## Step-by-Step Instructions for AI

### Step 1: Implement Redis Subscriber

1.  In `apps/kim-p-initiator/src/`, create a `redis` directory.
2.  Inside it, create a `RedisSubscriberService` and `RedisModule`.
3.  The `RedisSubscriberService` should connect to Redis and **subscribe** to the `TICKER_UPDATES` channel.
4.  When a message is received, it should parse the JSON and emit the price data to other services within the application using a NestJS `EventEmitter` or an RxJS `Subject`.

### Step 2: Implement the Opportunity Scanner

1.  In `apps/kim-p-initiator/src/`, create an `initiator` directory.
2.  Inside it, create an `OpportunityScannerService`.
3.  This service should listen for the price update events emitted by `RedisSubscriberService`.
4.  Upon receiving a price update, it must use the `SpreadCalculatorService` from our `@app/kimp-core` library to determine if a profitable "Normal" or "Reverse" opportunity exists.
5.  If a profitable opportunity is found, it should trigger the `TradeExecutorService`.

### Step 3: Implement the Trade Executor

1.  Create a `TradeExecutorService` within the `initiator` directory.
2.  This service will contain the main business logic for starting a trade. It should have a public method like `initiateArbitrageCycle(opportunity)`.
3.  The method must perform the following sequence:
    a. Use `PortfolioManagerService` to check for sufficient funds. If funds are insufficient, log it and stop.
    b. Use `ArbitrageRecordService` to create the initial `Trade` and `ArbitrageCycle` records in the database. The cycle's status should be `AWAITING_REBALANCE`.
    c. Wrap the entire trading logic in `LoggingService.run({ cycleId: newCycle.id }, ...)` to enable centralized tracing.
    d. Based on the opportunity type (Normal/Reverse), call the appropriate method from `StrategyHighService` or `StrategyLowService` to execute the first leg of the trade.
    e. Handle any errors during the trade execution using the `ErrorHandlerService`. If the trade fails, update the cycle status to `FAILED`.

### Step 4: Assemble the Application

1.  Open `apps/kim-p-initiator/src/kim-p-initiator.module.ts`.
2.  Import `KimpCoreModule` to gain access to all shared services.
3.  Create an `InitiatorModule` that provides and exports the `OpportunityScannerService` and `TradeExecutorService`.
4.  Import the `RedisModule` and the `InitiatorModule` into the root `KimPInitiatorModule`.

## Verification

- Start the `kimP-Feeder` application in one terminal.
- Start the `kimP-Initiator` application in another terminal (`yarn start:dev kim-p-initiator`).
- **Check the logs:** The `Initiator` should log that it has connected to Redis and is receiving price updates broadcast by the `Feeder`.
- **Test the logic:** When a real (or simulated) profitable price spread occurs, the `Initiator` logs should show that it has:
  1.  Detected an opportunity.
  2.  Created a new cycle in the database.
  3.  Initiated the trade.
- **Check the database:** The `arbitrage_cycles` table should contain a new row with the status `AWAITING_REBALANCE`.
