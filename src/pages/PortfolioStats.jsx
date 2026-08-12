import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Legend, Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { getInvestmentHistory } from '../lib/api'
import { fmt } from '../lib/utils'
import { useTheme } from '../lib/useTheme'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

// The four components of net worth. `label` names the slice in the stacked
// chart and the chips; `title` heads that component's own chart below.
const LAYERS = [
  { key: 'bank_balance', label: 'Bank',   title: 'Bank Balance', color: '#16a34a' },
  { key: 'hysa_balance', label: 'HYSA',   title: 'HYSA Balance', color: '#2563eb' },
  { key: 'stock_value',  label: 'Stocks', title: 'Stock Value',  color: '#9333ea' },
  { key: 'etf_total',    label: 'ETFs',   title: 'ETF Total',    color: '#d97706' },
]

function makeStackedChart(history, colors) {
  return {
    data: {
      labels: history.map(h => h.date),
      datasets: LAYERS.map(({ key, label, color }) => ({
        label,
        data: history.map(h => h[key] || 0),
        borderColor: color,
        backgroundColor: color + '55',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top', labels: { color: colors.tick, boxWidth: 12, padding: 16 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: $${fmt(ctx.parsed.y)}`,
            footer: items => `  Net Worth: $${fmt(items.reduce((s, i) => s + i.parsed.y, 0))}`,
          },
        },
      },
      scales: {
        x: { stacked: true, ticks: { color: colors.tick }, grid: { color: colors.grid } },
        y: { stacked: true, beginAtZero: true, ticks: { color: colors.tick, callback: v => '$' + fmt(v) }, grid: { color: colors.grid } },
      },
    },
  }
}

function makeLineChart(history, key, color, colors) {
  return {
    data: {
      labels: history.map(h => h.date),
      datasets: [{
        data: history.map(h => h[key] || 0),
        borderColor: color,
        backgroundColor: color + '22',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` $${fmt(ctx.parsed.y)}` } },
      },
      scales: {
        y: { beginAtZero: false, ticks: { color: colors.tick, callback: v => '$' + fmt(v) }, grid: { color: colors.grid } },
        x: { ticks: { color: colors.tick }, grid: { color: colors.grid } },
      },
    },
  }
}

export default function PortfolioStats() {
  const [history, setHistory] = useState([])
  const { colors } = useTheme()

  useEffect(() => {
    getInvestmentHistory().then(setHistory)
  }, [])

  if (history.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <h3>No history yet</h3>
        <p>Update your investments to start tracking portfolio history.</p>
      </div>
    )
  }

  const latest = history[history.length - 1]
  const stacked = makeStackedChart(history, colors)

  return (
    <div className="stats-container">
      <div className="card chart-card chart-card--tall">
        <div className="card-header"><h2>Net Worth Composition</h2></div>
        <div className="chart-container">
          <Line data={stacked.data} options={stacked.options} />
        </div>
      </div>

      <div className="summary-row">
        {LAYERS.map(({ key, label, color }) => (
          <div key={key} className="summary-chip" style={{ borderLeft: `3px solid ${color}` }}>
            <span className="summary-chip-label">{label}</span>
            <span className="summary-chip-value">${fmt(latest[key] || 0)}</span>
          </div>
        ))}
        <div className="summary-chip" style={{ borderLeft: '3px solid var(--text)' }}>
          <span className="summary-chip-label">Net Worth</span>
          <span className="summary-chip-value">${fmt(latest.net_worth || 0)}</span>
        </div>
      </div>

      {LAYERS.map(({ key, title, color }) => {
        const { data, options } = makeLineChart(history, key, color, colors)
        return (
          <div key={key} className="card chart-card">
            <div className="card-header"><h2>{title}</h2></div>
            <div className="chart-container">
              <Line data={data} options={options} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
