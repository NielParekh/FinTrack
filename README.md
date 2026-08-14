# FinTrack

A local-first personal finance desktop app for tracking investments and credit card spending. Your data stays on your machine as plain JSON — no cloud accounts, no telemetry.

Built with Electron, React, and Chart.js.

## What it does

- **Dashboard** — net worth trend, portfolio gain, monthly spend, and linked-card health
- **Investments** — bank and HYSA balances, stock positions with live prices from Yahoo Finance, and ETF holdings; asset allocation and net worth composition over time
- **Spending** — link credit cards through [Plaid](https://plaid.com) and transactions sync automatically, with auto-categorization and per-merchant overrides
- **Backup & Restore** — write every data file into a single JSON backup you can keep off this machine

Plaid is optional. Without it, everything except automated card syncing still works.

## Setup

Requires [Node.js](https://nodejs.org/) v16+.

```bash
git clone https://github.com/NielParekh/FinTrack.git
cd FinTrack
npm install
npm run dev
```

The app opens automatically and creates `./data/` on first run. That's all you need for investment tracking.

### Optional: credit card spending via Plaid

Sign up at [dashboard.plaid.com](https://dashboard.plaid.com) (free) and copy your `client_id` and Sandbox secret from **Developers → Keys**. Then:

```bash
cp .env.example .env
```

```
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_ENV=sandbox
```

Restart, then go to **Spending → Linked Cards → + Link a card** and use Plaid's test credentials `user_good` / `pass_good` (2FA `1234`) to see the flow with fake data.

To go live, swap in your Production secret and set `PLAID_ENV=production`. Link cards under **Spending → Linked Cards** and your brokerage under **Investments → ETFs** — a brokerage with a cash account feeds **HYSA** from the same connection.

> If a card needs re-authentication later, use **Re-link** rather than unlinking. Unlinking and linking again permanently consumes one of your 10 trial connections.

Linking opens in your default browser, since banks like Chase block Electron's embedded window. Credentials go to Plaid directly and are never seen by FinTrack.

### Build an installer

```bash
npm run dist        # macOS .dmg
npm run dist:win    # Windows .exe
npm run dist:linux  # Linux AppImage
```

Each target must be built on its own platform.

## Project structure

```
electron/
  main.js       # App entry, window creation
  preload.js    # Context bridge (IPC surface)
  handlers/     # IPC handlers: investments, hysa, spending, brokerage, backup
  lib/          # JSON storage, Yahoo prices, Plaid client, logging
src/
  pages/        # Dashboard, Investments, Spending, PortfolioStats, Data, …
  components/   # Sidebar, Topbar
  lib/          # api.js (IPC calls), navigation, utils, motion
data/           # Local JSON storage (gitignored)
```

## Data storage

All data lives in `./data/` as JSON — balances and positions, daily net worth snapshots, synced transactions, and linked-account metadata. In a packaged build it moves to the app's user-data directory.

Plaid access tokens are encrypted with the OS keychain (macOS Keychain, Windows DPAPI, libsecret on Linux) before being written to disk. Because that folder is the only copy, **Settings → Backup & Restore** is worth running periodically — a backup on the same disk doesn't survive the failure it exists for.

Packaged builds have no terminal attached, so errors go to a log file — `~/Library/Logs/FinTrack/main.log` on macOS, `%APPDATA%\FinTrack\logs\` on Windows, `~/.config/FinTrack/logs/` on Linux. Tokens and secrets are redacted.

## License

[MIT](LICENSE)
