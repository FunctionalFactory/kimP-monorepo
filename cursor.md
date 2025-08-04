# Mission Briefing: Full Project Audit & Documentation

## Overall Goal

- **Part 1 (Audit)**: Conduct an exhaustive, file-by-file A-to-Z audit of the entire monorepo to identify all potential issues, areas for improvement, and architectural strengths.
- **Part 2 (Documentation)**: Based on the audit, create a series of detailed README files that document the project's architecture, operational procedures, and potential risks.

## Current Branch

- Ensure all work is done on the `docs/full-system-audit-and-documentation` branch.

---

## **Part 1: Full System Audit**

### Instructions

- Before writing any documentation, you must first perform a deep analysis of the entire codebase. I will ask for the results of this audit when you create the READMEs.
- Go through every significant file in `packages/` and `apps/`.
- Analyze entities, dependencies, business logic, error handling, and potential security vulnerabilities.
- Pay special attention to the interactions between the microservices.

---

## **Part 2: Create Comprehensive Documentation**

### Instructions

- Based on your audit from Part 1, create the following new README files in a new top-level `/docs` directory.

#### **1. `docs/ARCHITECTURE.md`**

- **Purpose**: To provide a high-level overview of the system's architecture.
- **Content**:
  - A detailed diagram showing the relationship between all components (`Feeder`, `Initiator`, `Finalizer`, `Dashboard-BE`, `Dashboard-FE`, `kimp-core`, Redis, DB).
  - A description of each component's role and responsibility.
  - A detailed explanation of the end-to-end data flow for a single arbitrage cycle.

#### **2. `docs/BACKTESTING_GUIDE.md`**

- **Purpose**: To provide a step-by-step guide on how to run a backtest.
- **Content**:
  - **Required Data Format**: Explain the exact CSV format required for data uploads (columns: `candle_date_time_kst`, `trade_price`, etc.), using the provided sample files as a reference. Mention all supported timeframes (1-minute, 5-minute, 1-day, etc.).
  - **Step 1: Data Upload**: How to use the frontend dashboard to upload CSV data.
  - **Step 2: System Execution**: The exact terminal commands needed to run the system in backtesting mode (`FEEDER_MODE=backtest ...`).
  - **Step 3: Analyzing Results**: How to interpret the metrics, charts, and trade history on the results dashboard.

#### **3. `docs/ERROR_HANDLING.md`**

- **Purpose**: To document the system's error handling and recovery mechanisms.
- **Content**:
  - **Concurrency Errors**: Explain how pessimistic locking and the lock timeout mechanism prevent race conditions and "stuck" cycles.
  - **Transient Errors**: Detail how the Retry and Dead Letter Queue mechanisms work for recoverable failures.
  - **Logging**: Explain how the `cycle_id` correlation ID works for tracing distributed errors.
  - Provide a "Troubleshooting Guide" for common errors (e.g., "What to do when a cycle is in the DEAD_LETTER state").

#### **4. `docs/IMPROVEMENTS.md`**

- **Purpose**: To document all potential improvements and technical debt identified during your audit.
- **Content**:
  - Create a prioritized list of all recommended improvements.
  - For each item, provide a detailed explanation of the **Problem**, the proposed **Solution**, and the **Benefit** of implementing it.
  - Categorize the improvements (e.g., `Critical Security`, `Performance Optimization`, `Code Refactoring`).
  - This will serve as the future development roadmap for the project.
