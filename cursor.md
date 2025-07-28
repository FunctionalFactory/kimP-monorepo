# Mission Briefing: Unit Testing for `kimp-core` Exchange & Utility Services

## Overall Goal

- To write unit tests for the remaining critical services within the `kimp-core` library: the main `ExchangeService` and the calculation services.
- This will ensure that our core business logic for exchange interaction and profit calculation is reliable and correct.

## Current Branch

- Ensure all work is done on the `test/unit-kimp-core-exchange-utils` branch.

## Step-by-Step Instructions for AI

### 1. Test `ExchangeService` (Facade Pattern)

1.  Create a new test file: `packages/kimp-core/src/exchange/exchange.service.spec.ts`.
2.  **Mock Dependencies**: The purpose of `ExchangeService` is to delegate tasks to the correct underlying service (`UpbitService` or `BinanceService`). We need to mock `UpbitService` and `BinanceService` to verify this delegation works correctly.
3.  **Write Test Cases**:
    - Create a test case for `getBalances`. It should verify that `exchangeService.getBalances('upbit')` calls the `getBalances` method on the mocked `upbitService`, and NOT on the `binanceService`.
    - Create a similar test case for `createOrder`, verifying that `exchangeService.createOrder('binance', ...)` correctly calls the method on the mocked `binanceService`.

### 2. Test `FeeCalculatorService` (Pure Calculation)

1.  Create a new test file: `packages/kimp-core/src/utils/calculator/fee-calculator.service.spec.ts`.
2.  This service has no external dependencies, so we can test its calculation logic directly.
3.  **Write Test Cases**:
    - Create a test for a `HIGH_PREMIUM_SELL_UPBIT` scenario. Provide fixed inputs (e.g., amount: 100, upbitPrice: 710, binancePrice: 0.5, rate: 1400) and assert that the calculated `netProfit` is the expected value.
    - Create another test for a `LOW_PREMIUM_SELL_BINANCE` scenario with different inputs and assert the correctness of the calculation.

### 3. Test `SlippageCalculatorService` (Pure Calculation)

1.  Create a new test file: `packages/kimp-core/src/utils/calculator/slippage-calculator.service.spec.ts`.
2.  **Write Test Cases**:
    - Create a mock `OrderBook` object with sample bid/ask levels.
    - Call the `calculate` method with a specific `investmentAmount`.
    - Assert that the returned `averagePrice` and `slippagePercent` match the manually calculated, expected values.

## Verification

- Run the unit tests for the `kimp-core` package from the project's root directory.
- The command `yarn test packages/kimp-core` should run, and ALL tests, including the previously created database service tests, must pass successfully.
