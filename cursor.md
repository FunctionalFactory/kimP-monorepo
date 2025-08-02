# Mission Briefing: Build the Frontend Dashboard for Backtesting

## Overall Goal

- To build a user interface in our new `kimP-Dashboard-FE` Next.js application.
- This web dashboard will allow users to upload historical data and view backtesting results by communicating with our existing `kimP-Dashboard-BE` API.

## Current Branch

- Ensure all work is done on the `feature/build-backtesting-frontend` branch.

## Step-by-Step Instructions for AI

### 1. Create Page Layout and Structure

1.  Use the App Router (`app/` directory) for routing.
2.  Create a main layout (`app/layout.tsx`) with a simple navigation sidebar linking to three pages: "Data Management", "Run Backtest", and "Results Dashboard".
3.  Use Material-UI (MUI) components for all UI elements to ensure a professional look.

### 2. Implement the Data Management Page (`app/data-management/page.tsx`)

1.  **File Upload Component**:
    - Create a form with a file input that accepts `.csv` files.
    - On form submission, use `axios` to send a `multipart/form-data` request to the `POST /api/backtest/upload-data` backend endpoint.
    - Display success or error messages to the user.
2.  **Data List Component**:
    - Create a table that fetches and displays a list of historical data sets from the backend. (You will need to create a new `GET /api/backtest/datasets` endpoint in the `kimP-Dashboard-BE` for this).

### 3. Implement the Run Backtest Page (`app/run-backtest/page.tsx`)

1.  This page should be a simple user guide. Display clear, step-by-step instructions for the user on how to run a backtest using their terminal.
    - Example: "1. Select dataset...", "2. Start Feeder in backtest mode...", "3. Start Initiator/Finalizer...", "4. View results on the dashboard."

### 4. Implement the Results Dashboard Page (`app/results-dashboard/page.tsx`)

1.  **Fetch Results**: On page load, make a request to the `GET /api/backtest/results` backend endpoint.
2.  **Display Key Metrics**: Use MUI `Card` components to clearly display the main results:
    - Total Profit / Loss
    - Return on Investment (ROI)
    - Total Number of Trades
    - Win Rate (%)
3.  **Display Trade History**: Use an MUI `DataGrid` component to show a detailed table of all trades from the backtest.
4.  **(Optional but Recommended) Chart Visualization**: Use a library like `recharts` to display a line chart of the portfolio's value over time.

## Verification

- The frontend application should start without errors (`yarn workspace kimP-Dashboard-FE dev`).
- The user should be able to successfully upload a CSV file via the UI.
- After a backtest is run, the Results Dashboard should correctly fetch and display the performance data from the backend API.
