# Mission Briefing: Fix Failing Unit Tests in `ArbitrageRecordService`

## Overall Goal

- To fix the failing unit tests in `packages/kimp-core/src/db/arbitrage-record.service.spec.ts`.
- The tests are failing because the mock for the TypeORM QueryBuilder is incomplete and does not include the `.setLock()` method.

## Current Branch

- Continue working on the `test/unit-kimp-core-db` branch.

## Step-by-Step Instructions for AI

### 1. Locate the Test File

- Open the test file: `packages/kimp-core/src/db/arbitrage-record.service.spec.ts`.

### 2. Update the Mock Query Builder

- Find the section where the mock for the `createQueryBuilder` is defined (likely within a `beforeEach` block).
- The current mock is missing the `.setLock()` method, causing the tests to fail.
- Update the mock object to be fully chainable and include all methods used by the `findAndLockNextCycle` function: `.setLock()`, `.where()`, `.andWhere()`, `.orderBy()`, `.getOne()`, and `.execute()`.

### Code Example to Follow:

Please replace the existing mock query builder definition with the following complete version. This mock teaches the fake query builder how to handle all the required method calls.

```typescript
// Inside arbitrage-record.service.spec.ts

// This mock should be defined within the main `describe` block or `beforeEach`
const mockQueryBuilder = {
  setLock: jest.fn().mockReturnThis(), // <-- Add this line
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(null), // Default behavior
  execute: jest.fn().mockResolvedValue({ affected: 0 }), // For the UPDATE query
  set: jest.fn().mockReturnThis(), // For the UPDATE query
  update: jest.fn().mockReturnThis(), // For the UPDATE query
};

// Ensure the repository and manager mocks use this query builder
// Example:
// mockArbitrageCycleRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
// mockEntityManager.createQueryBuilder.mockReturnValue(mockQuery_builder);

After updating the mock definition, ensure that each test case (it(...)) properly configures the return value for .getOne() to simulate its specific scenario (e.g., returning a cycle object or returning null).

Verification
Run the unit tests again from the project's root directory.

The command yarn test packages/kimp-core should now pass all tests, including the three previously failing tests for ArbitrageRecordService.
```
