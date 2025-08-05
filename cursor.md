# Mission Briefing: Build an Advanced, Parameter-Driven Backtesting System

## Overall Goal

- To evolve our system into a sophisticated backtesting tool where users can upload their own historical data and test various trading strategies by dynamically setting parameters.

## Current Branch

- Ensure all work is done on the `feature/advanced-backtesting-system` branch.

---

## **Part 1: Foundational Upgrade (Database & API)**

### Step 1.1: Redesign the Historical Data Schema

1.  The existing `historical_price` entity is too simple. We need a more robust structure.
2.  In `packages/kimp-core/src/db/entities/`, create a new entity `candlestick.entity.ts`.
3.  This `Candlestick` entity must include columns for `exchange`, `symbol`, `timeframe` (e.g., '1m', '5m', '1d'), `timestamp`, `open`, `high`, `low`, `close`, and `volume`.
4.  **CRITICAL**: Create a unique composite index on `(exchange, symbol, timeframe, timestamp)` to prevent duplicate data entries.

### Step 1.2: Create a Backtest Session Management System

1.  In `packages/kimp-core/src/db/entities/`, create a new entity `backtest-session.entity.ts`.
2.  This `BacktestSession` entity will store the parameters and results for each test run. It should include columns for:
    - `id` (UUID)
    - `status` ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')
    - `parameters` (JSON column to store user-defined settings like `minSpread`, `maxLoss`, `investmentAmount`)
    - `results` (JSON column to store the final report)
    - `startTime`, `endTime`

### Step 1.3: Enhance the `Dashboard-BE` API

1.  In `apps/kim-p-dashboard-be/`, refactor the `BacktestingController` and `BacktestingService`.
2.  **Modify Data Upload**: The `POST /api/backtest/upload-data` endpoint must now accept `exchange`, `symbol`, and `timeframe` along with the CSV file to correctly populate the new `candlesticks` table.
3.  **New Session API**:
    - Create `POST /api/backtest/sessions`: This endpoint will accept the user's strategy parameters (`minSpread`, `maxLoss`, etc.), create a new record in the `backtest_sessions` table with `status: 'PENDING'`, and return the new `sessionId`.
    - Create `GET /api/backtest/sessions/:id`: This endpoint will fetch the status and final results of a specific backtest session.

---

## **Part 2: Implement the Dynamic Strategy Engine**

### Step 2.1: Refactor the `Feeder` for Session-based Backtesting

1.  When `Feeder` starts in `backtest` mode, it should now accept a `SESSION_ID` as an environment variable.
2.  It will query the `backtest_sessions` table to get the parameters for that session (e.g., which symbol and timeframe to use).
3.  It will then query the `candlesticks` table based on these parameters.
4.  **CRITICAL**: As it publishes data to Redis, every message must now be tagged with the `sessionId`.
    - Example Redis message: `{ "sessionId": "...", "symbol": "BTC", "price": 60000, ... }`

### Step 2.2: Refactor `Initiator` and `Finalizer` to be Session-Aware

1.  The `Initiator`'s `OpportunityScannerService` will now receive the `sessionId` from the Redis message.
2.  Instead of using a global setting, it will fetch the specific parameters for that `sessionId` (e.g., from a cache or by calling a service in `kimp-core`).
3.  It will then use these dynamic parameters (`minSpread`, `investmentAmount`) for its calculations.
4.  The `Finalizer` will do the same, using the session-specific `maxLoss` parameter for its rebalancing plan.

---

## **Part 3: Build the User Control Panel (Frontend)**

### Step 3.1: Create the Backtesting Control Panel Page

1.  In the `kimP-Dashboard-FE` app, create a new page at `/backtesting`.
2.  This page will be the main interface for running simulations. It must include:
    - Input fields for: "Minimum Entry Spread (%)", "Maximum Rebalance Loss (%)", and "Investment Amount per Trade (KRW)".
    - Dropdowns to select the datasets to use for Upbit and Binance (populated from `GET /api/backtest/datasets`).
    - A "Start Backtest" button.

### Step 3.2: Implement the Workflow

1.  When the user clicks "Start Backtest", the frontend sends the parameters to `POST /api/backtest/sessions`.
2.  The backend creates the session and returns a `sessionId`.
3.  The frontend then displays instructions for the user to run the `Feeder` in their terminal with the new `SESSION_ID`.
4.  The user can then navigate to the `Results Dashboard` page, which will now take a `sessionId` as a parameter to show the results for that specific test run.
