# Mission Briefing: Implement Advanced Features - Real-time Control & Backtesting

## Overall Goal

- To enhance the kimP system with two advanced features:
  1.  **Real-time Strategy Control**: Allow users to adjust key strategy parameters (like entry premium) via an API without restarting the system.
  2.  **Historical Backtesting System**: Enable simulation of the system's performance using user-provided historical price data.

## Current Branch

- Ensure all work is done on the `feature/advanced-controls-and-backtesting` branch.

---

## **Part 1: Real-time Strategy Control**

### Step 1.1: Create DB-based Settings System in `kimp-core`

1.  **New Entity**: In `packages/kimp-core/src/db/entities/`, create a new `system-setting.entity.ts`. This table will store key-value pairs (e.g., `key: 'INITIATOR_MIN_SPREAD'`, `value: '0.5'`).
2.  **New Service**: In `packages/kimp-core/src/utils/service/`, create a new `settings.service.ts`.
    - This service will read settings from the `system_settings` table.
    - Implement a caching mechanism (e.g., cache settings for 60 seconds) to avoid frequent DB queries.
    - Provide methods like `getSetting(key: string)` and `updateSetting(key: string, value: string)`.

### Step 1.2: Create a Settings API Endpoint

1.  We will need a new application to act as a BFF (Backend for Frontend). Generate a new app using the Nest CLI: `nest generate app kimP-Dashboard-BE`.
2.  In this new app, create a `SettingsController` with two endpoints:
    - `GET /api/settings`: Fetches all current settings using the new `SettingsService`.
    - `PUT /api/settings`: Updates one or more settings in the database using the `SettingsService`.

### Step 1.3: Refactor `Initiator` and `Finalizer`

1.  Modify `OpportunityScannerService` in `kimP-Initiator` and `RebalancePlannerService` in `kimP-Finalizer`.
2.  Instead of injecting `InvestmentConfigService` for strategy values, inject the new `SettingsService`.
3.  Replace calls like `config.minSpreadPercent` with `await this.settingsService.getSetting('INITIATOR_MIN_SPREAD')`.

---

## **Part 2: Historical Data Backtesting System**

### Step 2.1: Implement a CSV Data Importer

1.  In the `kimP-Dashboard-BE` application, create a new `BacktestingModule`.
2.  Inside it, create a `CsvParsingService` to parse the provided OHLCV CSV files.
3.  Create a `BacktestingController` with a `POST /api/backtest/upload-data` endpoint that accepts CSV file uploads.
4.  This endpoint will use the `CsvParsingService` and `ArbitrageRecordService` (from `kimp-core`) to save the parsed historical data into the `historical_price` entity we designed. Map `candle_date_time_kst` to `timestamp` and `trade_price` to `price`.

### Step 2.2: Enhance "Backtesting Mode" in `kimP-Feeder`

1.  Modify the `PriceFeedService` in `apps/kim-p-feeder/`.
2.  When `FEEDER_MODE` is `backtest`, the service must:
    a. Query all data from the `historical_prices` table, ordered by `timestamp` ascending.
    b. Loop through the results and publish each row's `price` data to the `TICKER_UPDATES` Redis channel.
    c. Implement a simple delay mechanism (e.g., `await new Promise(res => setTimeout(res, 100))`) between each publish to simulate a real-time feed rather than publishing all data at once.

### Step 2.3: Implement Backtest Reporting API

1.  In the `BacktestingController` of `kimP-Dashboard-BE`, create a `GET /api/backtest-results` endpoint.
2.  This endpoint will query the `arbitrage_cycles` and `portfolio_logs` tables.
3.  It should calculate and return a summary report containing key metrics:
    - Total Profit / Loss
    - Return on Investment (ROI)
    - Total Number of Trades
    - Win Rate (%)
    - A list of all completed trades with timestamps and profits.

## Verification

- **For Real-time Control**:
  - Run all apps. Use a tool like Postman to hit the new `PUT /api/settings` endpoint to change the minimum spread.
  - Observe the `Initiator` logs to confirm that it starts using the new spread value for its calculations.
- **For Backtesting**:
  - Manually insert some sample historical price data into the `historical_prices` table.
  - Run the `Feeder` with `FEEDER_MODE=backtest`. Run `Initiator` and `Finalizer` as normal.
  - Verify that the `Feeder` publishes the historical data to Redis.
  - Verify that the `Initiator` and `Finalizer` process this data and create completed cycles in the database based on the historical opportunities.
