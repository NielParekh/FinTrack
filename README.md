# FinTrack

A personal finance desktop app for tracking expenses and investments. Built with Electron and React.

## Features

- **Expense Tracking** — Add, edit, and delete expenses across categories (Food, Rent, Travel, Misc)
- **Investment Portfolio** — Track bank balance, HYSA, individual stocks, and ETFs
- **Portfolio Stats** — Charts showing net worth and portfolio breakdown over time
- **Spending Stats** — Visual breakdowns of expenses by category and over time
- **Local Storage** — All data stored in JSON files on your machine. No accounts, no cloud.

## Tech Stack

- [Electron](https://www.electronjs.org/) — desktop shell and file I/O
- [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) — UI
- [Chart.js](https://www.chartjs.org/) — charts

## Getting Started

```bash
npm install
npm run dev
```

## Build

```bash
npm run dist   # produces a .dmg for macOS
```

## Project Structure

```
FinTrack/
├── electron/
│   ├── main.js        # Main process — IPC handlers, file I/O
│   └── preload.js     # Context bridge
├── src/
│   ├── App.jsx        # Root component and tab routing
│   ├── main.jsx       # React entry point
│   ├── index.css      # Global styles
│   ├── components/    # Sidebar, Topbar, ExpenseModal
│   ├── pages/         # Expenses, Investments, Stats, PortfolioStats
│   └── lib/           # api.js (IPC calls), constants.js
├── data/              # Local JSON data (gitignored)
├── index.html
├── vite.config.js
└── package.json
```
