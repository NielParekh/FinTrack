# FinTrack

A local-first personal finance desktop app for tracking investments and credit card spending. No cloud accounts, no telemetry — your financial data stays on your machine.

Built with Electron, React, and Chart.js.

---

## Features

### Investment Portfolio
- **Overview** — net worth, total invested, total gain/loss, and asset allocation doughnut chart
- **Bank** — track your checking/savings balance
- **Stocks** — add positions by ticker + share count with live prices fetched from Yahoo Finance; real-time P&L; record sales to track realized gains
- **ETFs** — track ETF positions by ticker + current dollar value with P&L
- **HYSA** — log deposits and withdrawals to track principal separately from interest earned; update current value to calculate interest return

### Portfolio Stats
- Stacked area chart showing net worth composition over time (Bank, HYSA, Stocks, ETFs)
- Individual line charts for each asset class
- Snapshots saved automatically on every investment update

### Credit Card Spending (optional, via Plaid)
- Link credit cards once through [Plaid](https://plaid.com) — transactions sync automatically, no manual entry
- Auto-categorization with per-merchant overrides ("always categorize Starbucks as Dining")
- Monthly spend dashboard with category breakdown chart; card payments excluded from spend totals
- Access tokens encrypted at rest with the macOS Keychain and never leave your machine
- Entirely optional — the rest of the app works without any API keys

### General
- Light and dark mode (persisted across sessions)
- 100% local — all data stored as plain JSON files on your machine

---

## Setup

### 1. Prerequisites

- macOS
- [Node.js](https://nodejs.org/) v16 or newer (check with `node --version`)

### 2. Install and run

```bash
git clone https://github.com/NielParekh/FinTrack.git
cd FinTrack
npm install
npm run dev
```

The app window opens automatically. Data files are created in `./data/` on first run.

That's it for investment tracking — no configuration needed. Continue below only if you want automated credit card spending.

### 3. (Optional) Enable credit card spending via Plaid

**a. Get free Plaid API keys**

1. Sign up at [dashboard.plaid.com](https://dashboard.plaid.com) (free, no credit card required)
2. Go to **Developers → Keys** and copy your `client_id` and **Sandbox** secret

**b. Create your `.env` file**

```bash
cp .env.example .env
open -t .env
```

Fill in your keys:

```
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_ENV=sandbox
```

`.env` is gitignored — your keys never get committed.

**c. Test the flow in Sandbox (fake data)**

1. Restart the app (`npm run dev`)
2. Go to **Spending → Linked Cards → + Link a card**
3. Pick any bank and log in with Plaid's test credentials:
   - username: `user_good`
   - password: `pass_good`
   - 2FA code (if asked): `1234`
4. Fake transactions sync automatically — check **Spending → Overview**

**d. Go live with real cards**

1. In the Plaid dashboard, apply for **Production** access (describe it as a personal finance app for your own use)
2. Once approved, update `.env` with your Production secret and set `PLAID_ENV=production`
3. Restart the app and link your real cards — your bank credentials are entered in Plaid's own secure widget and are never seen or stored by FinTrack

> **Cost:** Plaid's free tier covers up to 10 linked accounts — plenty for personal use.

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
│   ├── main.js            # App entry, window creation
│   ├── preload.js         # Context bridge (IPC surface)
│   ├── handlers/          # IPC handlers: investments, hysa, spending
│   └── lib/               # data.js (JSON storage), prices.js (Yahoo), plaid.js
├── src/
│   ├── pages/             # Investments, Bank, Stocks, HYSA, ETFs, PortfolioStats,
│   │                      # Spending, SpendingAccounts
│   ├── components/        # Sidebar, Topbar
│   └── lib/               # api.js (IPC calls), navigation.js, utils.js
├── data/                  # Local JSON storage (gitignored)
├── .env.example           # Template for Plaid keys (copy to .env)
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
| [Plaid](https://plaid.com/docs/) | Bank/card transaction sync (optional) |
| [Electron Builder](https://www.electron.build/) | macOS packaging |

---

## Data Storage

All data lives in `./data/` as plain JSON files:

| File | Contents |
|------|---------|
| `investments.json` | Balances, positions, cost bases |
| `investment_history.json` | Daily net worth snapshots |
| `hysa_transactions.json` | HYSA deposit/withdrawal history |
| `plaid_items.json` | Linked card metadata + encrypted access tokens |
| `spending_transactions.json` | Synced credit card transactions |
| `spending_categories.json` | Category list and merchant → category rules |

The `data/` directory is gitignored — your financial data never leaves your machine. Plaid access tokens are encrypted with the macOS Keychain before being written to disk.

---

## License

[MIT](LICENSE)
