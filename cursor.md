# Mission Briefing: Unit & Functional Tests for `kimP-Feeder`

## Overall Goal

- To write unit and functional tests for the `kimP-Feeder` application.
- This will verify its core responsibilities: connecting to external services (WebSockets, Redis) and correctly relaying data.
- We will also implement the Health Check endpoint that was recommended in the architecture review.

## Current Branch

- Ensure all work is done on the `test/unit-feeder-app` branch. (You should create this branch first)

## Step-by-Step Instructions for AI

### 1. Implement Health Check Endpoint

1.  In `apps/kim-p-feeder/src/`, create a `health` directory with a `HealthController` and `HealthModule`.
2.  The `HealthController` should have a `@Get('/health')` endpoint.
3.  This endpoint should check the connection status of `PriceFeedService` and `RedisPublisherService` and return a status object.
    ```json
    {
      "status": "ok", // or "error"
      "dependencies": {
        "webSockets": "connected", // or "disconnected"
        "redis": "connected" // or "disconnected"
      }
    }
    ```
4.  Import the `HealthModule` into the root `KimPFeederModule`.

### 2. Set Up Test Environment

1.  Create test files for the new services:
    - `apps/kim-p-feeder/src/price-feed/price-feed.service.spec.ts`
    - `apps/kim-p-feeder/src/redis/redis-publisher.service.spec.ts`
    - `apps/kim-p-feeder/src/health/health.controller.spec.ts`
2.  For each test file, use `@nestjs/testing`'s `Test.createTestingModule` to set up the environment.
3.  **Mock Dependencies**:
    - When testing `PriceFeedService`, mock the `RedisPublisherService` and the `ws` library.
    - When testing `RedisPublisherService`, mock the `ioredis` library.
    - When testing `HealthController`, mock both `PriceFeedService` and `RedisPublisherService`.

### 3. Write Unit Test Cases

1.  **For `RedisPublisherService`**:
    - Write a test to ensure it calls the `redis.publish()` method with the correct channel (`TICKER_UPDATES`) and a properly stringified JSON payload when its `publishPriceUpdate` method is called.
2.  **For `PriceFeedService`**:
    - Write a test to ensure that when a mock WebSocket emits a 'message' event, the service correctly calls `redisPublisherService.publishPriceUpdate`.
3.  **For `HealthController`**:
    - Write a test to check that the `/health` endpoint returns a 200 OK status.
    - Write another test to verify that if the mocked `RedisPublisherService` reports a disconnected state, the health check response reflects this.

## Verification

- Run the unit tests for the `kimP-Feeder` package from the project's root directory.
- The command `yarn test apps/kim-p-feeder` must run, and all new tests should pass successfully.
- This will confirm that the Feeder is robust and its status is monitorable before we rely on it in other services.
