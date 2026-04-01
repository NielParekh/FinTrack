# FinTrack

A local-first personal finance app for tracking expenses and investments. No cloud, no accounts, no telemetry — your financial data stays on your machine.

Built with Electron, React, and Chart.js.

<!-- Add a screenshot: ![FinTrack Screenshot](screenshot.png) -->

---

## Features

- **Expense Tracking** — Add, edit, and delete expenses by date and category with monthly summaries
- **Investment Portfolio** — Track bank balances, HYSA deposits/withdrawals, stock and ETF positions with live prices from Yahoo Finance
- **Cost Basis & P/L** — Log cost basis per holding and see profit/loss at a glance
- **Net Worth Over Time** — Line charts for net worth, bank, HYSA, stocks, and ETFs with daily snapshots
- **Spending Analytics** — Monthly trends, category breakdowns, cumulative spending charts
- **Dark Mode** — Full light/dark theme toggle
- **100% Local** — All data stored as JSON files on disk, no API keys required

---

## Getting Started

**Prerequisites:** macOS, Node.js v16+, npm

```bash
git clone https://github.com/NielParekh/FinTrack.git
cd FinTrack
npm install
npm run dev
```

The app opens automatically. Data files are created in `./data/` on first run.

### Build for macOS

```bash
npm run dist
```

Outputs a `.dmg` installer to the `dist/` folder.

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

## License

[MIT](LICENSE)
