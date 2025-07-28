# Mission Briefing: Phase 2 - Build the `kimP-Feeder` Application

## Overall Goal

- To build our first microservice, `kimP-Feeder`.
- This application's sole responsibility is to connect to exchange WebSockets, receive real-time price data, and publish it to a Redis Pub/Sub channel for other services to consume.

## Current Branch

- Ensure all work is done on the `feature/build-feeder-app` branch.

## Step-by-Step Instructions for AI

### Step 1: Migrate and Refactor `PriceFeedService`

1.  Move the `price-feed.service.ts` file from `apps/kim-p-legacy/src/marketdata/` to `apps/kim-p-feeder/src/price-feed/`.
2.  Move the `marketdata.module.ts` to the same directory. Rename the module to `PriceFeedModule` and the class to `PriceFeedModule`.
3.  Refactor `price-feed.service.ts`. It no longer needs to use `Subject` or `BehaviorSubject`. Its only job is to receive data and pass it to a new `RedisPublisherService`.
4.  Remove dependencies on any services that are not directly related to fetching prices (like `ArbitrageFlowManagerService`). The service should now only depend on `ConfigService` and `ExchangeService` (for initial data like order books).

### Step 2: Create `RedisPublisherService`

1.  We need a way to connect to Redis. Add a Redis client library like `ioredis` to the root `package.json` dev dependencies.
2.  Create a new `redis` directory inside `apps/kim-p-feeder/src/`.
3.  Create a new file `redis-publisher.service.ts` in this directory.
4.  Implement a service that connects to a Redis server (connection details from `.env`).
5.  Create a public method `publishPriceUpdate(data: PriceUpdateData)` that takes price data and publishes it as a JSON string to a specific Redis channel (e.g., `TICKER_UPDATES`).
6.  Create a `RedisModule` to provide and export this service.

### Step 3: Connect the Services

1.  Inject the new `RedisPublisherService` into `PriceFeedService`.
2.  In `PriceFeedService`, whenever a new price update is received from an exchange WebSocket, call the `redisPublisherService.publishPriceUpdate()` method with the data.

### Step 4: Assemble the `kimP-Feeder` Application

1.  Open `apps/kim-p-feeder/src/kim-p-feeder.module.ts`.
2.  Import the `PriceFeedModule` and the `RedisModule`.
3.  Also, import the `KimpCoreModule` from `@app/kimp-core` because `PriceFeedService` depends on services from it.

## Verification

- After implementation, run `yarn install` to get the new `ioredis` package.
- Run the application using `yarn start:dev kim-p-feeder`.
- The application should start without errors and log that it is connected to both exchange WebSockets and the Redis server.
- Using a Redis client (like `redis-cli`), you should be able to `SUBSCRIBE TICKER_UPDATES` and see a real-time stream of price data being published.
