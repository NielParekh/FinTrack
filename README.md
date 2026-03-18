# FinTrack

A personal finance desktop app for tracking expenses and investments — fully local, no accounts required. Built with Electron + React.

> **Platform:** macOS only (for now)

---

## Features

### Expense Tracking
- Add, edit, and delete expenses with date and category
- Categories: Food, Rent, Travel, Misc
- Total expense summary at a glance

### Investment Portfolio
- **Bank** — track your checking/savings balance
- **HYSA** — log deposits and withdrawals with a running balance and notes
- **Stocks** — add positions by ticker + share count with live price fetching
- **ETFs** — track ETF positions and total value
- **Investments Overview** — consolidated net worth, total invested, total gains, and cost basis management

### Analytics
- **Portfolio Stats** — line charts for net worth, bank balance, HYSA, stocks, and ETFs over time
- **Spending Stats** — monthly trend, category pie chart, cumulative spending, and stacked category breakdown

### Data Storage
- All data saved locally as JSON files — no cloud, no accounts, no telemetry
- Stock prices fetched live from Yahoo Finance (no API key needed)

---

## Prerequisites

- **macOS** (the build target is `.dmg`)
- **Node.js** v16+ and npm
- Internet connection (for live stock price fetching)

---

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/NielParekh/FinTrack.git
cd FinTrack

# 2. Install dependencies
npm install

# 3. Start the app in development mode
npm run dev
```

The app window will open automatically. Data files are created in `./data/` on first run.

---

## Build (macOS .dmg)

```bash
npm run dist
```

This builds the React app with Vite and packages it with Electron Builder. The output `.dmg` installer will be in the `dist/` folder. Once installed, data is stored in `~/Library/Application Support/FinTrack/data/`.

---

## Project Structure

```
FinTrack/
├── electron/
│   ├── main.js              # App entry point, window creation, IPC registration
│   ├── preload.js           # Context bridge (exposes safe IPC API to React)
│   ├── handlers/
│   │   ├── expenses.js      # CRUD for expenses
│   │   ├── investments.js   # Portfolio management, live price updates, snapshots
│   │   └── hysa.js          # HYSA transaction management
│   └── lib/
│       ├── data.js          # JSON file I/O and initialization
│       └── prices.js        # Yahoo Finance price fetching
├── src/
│   ├── App.jsx              # Root component and tab routing
│   ├── components/
│   │   ├── Sidebar.jsx      # Left navigation
│   │   ├── Topbar.jsx       # Header with breadcrumbs
│   │   └── ExpenseModal.jsx # Add/edit expense form
│   ├── pages/
│   │   ├── Expenses.jsx     # Transaction list
│   │   ├── Investments.jsx  # Portfolio overview
│   │   ├── Bank.jsx         # Bank balance updater
│   │   ├── Stocks.jsx       # Stock positions + live prices
│   │   ├── HYSA.jsx         # HYSA transactions
│   │   ├── ETFs.jsx         # ETF holdings
│   │   ├── PortfolioStats.jsx  # Portfolio charts
│   │   └── Stats.jsx        # Spending charts
│   └── lib/
│       ├── api.js           # IPC call wrappers
│       ├── constants.js     # Category definitions
│       ├── utils.js         # Currency, date, and gain formatters
│       └── navigation.js    # Page routing definitions
├── data/                    # Local JSON data (gitignored)
├── index.html
├── vite.config.js
└── package.json
```

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| [Electron 28](https://www.electronjs.org/) | Desktop shell, file I/O, IPC |
| [React 18](https://react.dev/) | UI components |
| [Vite 5](https://vitejs.dev/) | Dev server and bundler |
| [Chart.js 4](https://www.chartjs.org/) | Charts and data visualization |
| [Electron Builder](https://www.electron.build/) | macOS `.dmg` packaging |
| Yahoo Finance API | Live stock/ETF prices (unauthenticated) |

---

## Data Files

All data lives in the `data/` directory (created automatically on first run):

| File | Contents |
|------|---------|
| `transactions.json` | Expense records |
| `investments.json` | Portfolio state (balances, stocks, ETFs, cost bases) |
| `investment_history.json` | Daily snapshots used for charts |
| `hysa_transactions.json` | HYSA deposit/withdrawal log |

These files are gitignored — your financial data never leaves your machine.
