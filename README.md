# FinTrack

A local-first personal finance desktop app for tracking expenses and investments. No cloud, no accounts, no telemetry — your financial data stays on your machine.

Built with Electron, React, and Chart.js.

---

## Features

### Expense Tracking
- Add, edit, and delete expenses with date, amount, category, and an optional note
- 10 built-in categories: Food, Rent, Travel, Utilities, Entertainment, Health, Shopping, Subscriptions, Education, Misc
- Running total of all expenses

### Spending Analytics
- Monthly expenses over time (line chart)
- Spending breakdown by category (pie chart)
- Cumulative spending over time
- Category spending over time (stacked area chart)

### Investment Portfolio
- **Overview** — net worth, total invested, total gain/loss, and asset allocation doughnut chart
- **Bank** — track your checking/savings balance
- **Stocks** — add positions by ticker + share count with live prices fetched from Yahoo Finance; real-time P&L; record sales to track realized gains
- **ETFs** — track ETF positions by ticker + current dollar value with P&L
- **HYSA** — log deposits to track principal separately from interest earned; update current value to calculate interest return

### Portfolio Stats
- Stacked area chart showing net worth composition over time (Bank, HYSA, Stocks, ETFs)
- Individual line charts for each asset class
- Snapshots saved automatically on every investment update

### General
- Light and dark mode (persisted across sessions)
- 100% local — all data stored as plain JSON files, no API keys required

---

## Getting Started

**Prerequisites:** macOS, Node.js v16+

```bash
git clone https://github.com/NielParekh/FinTrack.git
cd FinTrack
npm install
npm run dev
```

The app opens automatically. Data files are created in `./data/` on first run.

### Build a macOS installer

```bash
npm run dist
```

Outputs a `.dmg` to the `dist/` folder.

---

## Project Structure

```
FinTrack/
├── electron/
│   ├── main.js        # IPC handlers, file I/O
│   └── preload.js     # Context bridge
├── src/
│   ├── pages/         # Expenses, Stats, Investments, Bank, Stocks, HYSA, ETFs, PortfolioStats
│   ├── components/    # Sidebar, Topbar, ExpenseModal
│   └── lib/           # api.js (IPC calls), constants.js, utils.js
├── data/              # Local JSON storage (gitignored)
└── index.html
```

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| [Electron 28](https://www.electronjs.org/) | Desktop shell and file I/O |
| [React 18](https://react.dev/) | UI components |
| [Vite 5](https://vitejs.dev/) | Dev server and bundler |
| [Chart.js 4](https://www.chartjs.org/) | Data visualization |
| [Electron Builder](https://www.electron.build/) | macOS packaging |

---

## Data Storage

All data lives in `./data/` as plain JSON files:

| File | Contents |
|------|---------|
| `transactions.json` | Expense entries |
| `investments.json` | Balances, positions, cost bases |
| `investment_history.json` | Daily net worth snapshots |
| `hysa_transactions.json` | HYSA deposit history |

The `data/` directory is gitignored — your financial data never leaves your machine.

---

## License

[MIT](LICENSE)
