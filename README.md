# FinTrack

A local-first personal finance desktop app for tracking investments and credit card spending. No cloud accounts, no telemetry — your financial data stays on your machine.

Built with Electron, React, and Chart.js.

---

## Features

### Dashboard
- Net worth headline with a 1M / 6M / 1Y / All range toggle driving the trend chart
- Stat tiles for portfolio gain, this month's spend vs. last month, cash, and invested — each links to its detail page
- Recent purchases and linked-card health at a glance

### Investment Portfolio
- **Overview** — net worth, total invested, total gain/loss, and asset allocation doughnut chart
- **Bank** — track your checking/savings balance
- **Stocks** — add positions by ticker + share count with live prices fetched from Yahoo Finance; real-time P&L; record sales to track realized gains
- **ETFs** — sync holdings automatically from a linked brokerage via Plaid Investments (shares, cost basis, value, and per-position P&L), or enter them by hand if you'd rather
- **HYSA** — sync your balance straight from a linked cash account via Plaid; log deposits and withdrawals to track principal separately, so interest earned is the difference between the two

### Portfolio Stats
- Stacked area chart showing net worth composition over time (Bank, HYSA, Stocks, ETFs)
- Individual line charts for each asset class
- Snapshots saved automatically on every investment update

### Credit Card Spending (optional, via Plaid)
- Link credit cards once through [Plaid](https://plaid.com) — transactions sync automatically, no manual entry
- Auto-categorization with per-merchant overrides ("always categorize Starbucks as Dining")
- Monthly spend overview with category breakdown; card payments and refunds excluded from spend totals
- **Charts** tab with spend-by-month, by-category, and top-merchant views, filterable by month, card, and category
- Re-link a card that needs re-authentication without losing its transaction history
- Access tokens encrypted at rest with the OS keychain and never leave your machine
- Entirely optional — the rest of the app works without any API keys

### Backup & Restore
- Save every data file into a single JSON backup you can keep off this machine
- Restore validates the file before writing anything, and snapshots your current data first so a mistaken restore can be undone
- Backups from another Mac are detected: Plaid tokens are encrypted to the machine that wrote them, so the app offers to restore everything except the bank connections

### General
- Light and dark mode (persisted across sessions)
- 100% local — all data stored as plain JSON files on your machine

---

## Setup

### 1. Prerequisites

- macOS, Windows, or Linux
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

New accounts get a free **Trial plan** — real production data, up to 10 linked connections, with Transactions and Investments both included. Sandbox is still worth using first to see the flow with fake data.

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
3. Log in with Plaid's test credentials: `user_good` / `pass_good` (2FA code `1234`)
4. Fake transactions sync automatically — check **Spending → Overview**

**d. Go live with real accounts**

Swap in your Production secret, set `PLAID_ENV=production`, and restart. Link cards under **Spending → Linked Cards**, and your brokerage under **Investments → ETFs**. A brokerage with a cash account also feeds **Investments → HYSA** — the same connection covers both, so it costs no extra link.

Linking opens in your default browser (Plaid Hosted Link) — banks like Chase block Electron's embedded window. Your credentials go to Plaid directly and are never seen or stored by FinTrack.

> If a card later needs re-authentication, use **Re-link** rather than unlinking. It keeps your transaction history, and unlink + link again permanently consumes one of your 10 trial connections.

### Build an installer

```bash
npm run dist        # macOS .dmg
npm run dist:win    # Windows .exe
npm run dist:linux  # Linux AppImage
```

Each target must be built on its own platform. Packaged builds read `.env` from the app's user-data folder (the error message names the exact path).

---

## Project Structure

```
FinTrack/
├── electron/
│   ├── main.js            # App entry, window creation
│   ├── preload.js         # Context bridge (IPC surface)
│   ├── handlers/          # IPC handlers: investments, hysa, spending,
│   │                      # brokerage, backup
│   └── lib/               # data.js (JSON storage), prices.js (Yahoo),
│                          # plaid.js (client), plaidLink.js (Hosted Link
│                          # flow), logger.js (file logging + redaction)
├── src/
│   ├── pages/             # Dashboard, Investments, Bank, Stocks, HYSA, ETFs,
│   │                      # PortfolioStats, Spending, SpendingCharts,
│   │                      # SpendingAccounts, Data
│   ├── components/        # Sidebar, Topbar
│   └── lib/               # api.js (IPC calls), navigation.js, utils.js,
│                          # motion.js + usePress.js (spring interactions)
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
| [Motion](https://motion.dev/) | Spring-based interaction feedback |
| [Plaid](https://plaid.com/docs/) | Card transactions and brokerage holdings (optional) |
| [electron-log](https://github.com/megahertz/electron-log) | File logging for packaged builds |
| [Electron Builder](https://www.electron.build/) | macOS / Windows / Linux packaging |

---

## Data Storage

All data lives in `./data/` as plain JSON files:

| File | Contents |
|------|---------|
| `investments.json` | Balances, positions, cost bases |
| `investment_history.json` | Daily net worth snapshots |
| `hysa_transactions.json` | HYSA deposit/withdrawal history |
| `plaid_items.json` | Linked card/brokerage metadata + encrypted access tokens |
| `plaid_holdings.json` | Synced brokerage holdings |
| `spending_transactions.json` | Synced credit card transactions |
| `spending_categories.json` | Category list and merchant → category rules |

The `data/` directory is gitignored — your financial data never leaves your machine. Plaid access tokens are encrypted with the OS keychain (macOS Keychain, Windows DPAPI, libsecret on Linux) before being written to disk.

In dev, files live in `./data/`. In a packaged build they move to the app's user-data directory.

Because that folder is the only copy, **Settings → Backup & Restore** writes all of it into a single file you can keep elsewhere. Worth doing periodically — a backup on the same disk doesn't survive the failure it exists for.

### Logs

A packaged app has no terminal attached, so failures are written to a log file instead:

| Platform | Path |
|------|---------|
| macOS | `~/Library/Logs/FinTrack/main.log` |
| Windows | `%APPDATA%\FinTrack\logs\main.log` |
| Linux | `~/.config/FinTrack/logs/main.log` |

Rotates at 5 MB. Access tokens and API secrets are redacted before anything is written.

---

## License

[MIT](LICENSE)
