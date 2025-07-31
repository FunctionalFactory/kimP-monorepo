# Mission Briefing: Implement Health Check Endpoint for `kimP-Feeder`

## Overall Goal

- To implement a `/health` endpoint in the `kimP-Feeder` application as recommended by the architecture review.
- This will provide a way to externally monitor the status of the Feeder's critical connections (WebSockets and Redis), enhancing the system's operational stability.

## Current Branch

- Ensure all work is done on the `feature/feeder-health-check` branch.

## Step-by-Step Instructions for AI

### 1. Enhance Core Services to Report Status

1.  **`PriceFeedService`**:
    - Open `apps/kim-p-feeder/src/price-feed/price-feed.service.ts`.
    - Add a new public method `getConnectionStatus(): 'connected' | 'disconnected'`.
    - This method should return `'connected'` if the `allConnectionsEstablished` BehaviorSubject currently holds `true`, and `'disconnected'` otherwise.
2.  **`RedisPublisherService`**:
    - Open `apps/kim-p-feeder/src/redis/redis-publisher.service.ts`.
    - Add a new public method `getRedisStatus(): 'connected' | 'disconnected'`.
    - This method should check the status of the underlying `ioredis` client (e.g., `this.redis.status`) and return `'connected'` or `'disconnected'` accordingly.

### 2. Create the Health Module

1.  In `apps/kim-p-feeder/src/`, create a new `health` directory.
2.  Inside it, create `health.controller.ts` and `health.module.ts`.
3.  **`HealthController`**:
    - Create a controller with a `@Get('/health')` endpoint.
    - Inject both `PriceFeedService` and `RedisPublisherService`.
    - The handler for the `/health` endpoint should call the new status methods on both services and return a JSON object in the specified format. If any service reports a disconnected state, the top-level `status` should be `'error'`.

    ```typescript
    // Example implementation in HealthController
    @Get('/health')
    checkHealth() {
      const wsStatus = this.priceFeedService.getConnectionStatus();
      const redisStatus = this.redisPublisherService.getRedisStatus();

      const isOk = wsStatus === 'connected' && redisStatus === 'connected';

      return {
        status: isOk ? 'ok' : 'error',
        dependencies: {
          webSockets: wsStatus,
          redis: redisStatus,
        },
        uptime: process.uptime(),
      };
    }
    ```

4.  **`HealthModule`**: This module should import any modules needed by the `HealthController` (like `PriceFeedModule`, `RedisModule`) and declare the controller.

### 3. Assemble the Application

1.  Open `apps/kim-p-feeder/src/kim-p-feeder.module.ts`.
2.  Import the new `HealthModule`.

### 4. Write Unit Tests

1.  Create a new test file: `apps/kim-p-feeder/src/health/health.controller.spec.ts`.
2.  Write unit tests for the `HealthController`.
    - Test that it returns a `status: 'ok'` when both mocked services report `'connected'`.
    - Test that it returns a `status: 'error'` if either of the mocked services reports `'disconnected'`.

## Verification

- Run the unit tests for the `kimP-Feeder` application: `yarn test apps/kim-p-feeder`. All tests must pass.
- Run the application: `yarn start:dev kim-p-feeder`.
- Open a web browser or use a tool like Postman to access `http://localhost:3001/health`.
- Verify that the JSON response is returned correctly and reflects the actual connection statuses.
