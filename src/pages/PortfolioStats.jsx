import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Legend, Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { getInvestmentHistory } from '../lib/api'
import { fmt } from '../lib/utils'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const LAYERS = [
  { key: 'bank_balance', label: 'Bank',   color: '#16a34a' },
  { key: 'hysa_balance', label: 'HYSA',   color: '#2563eb' },
  { key: 'stock_value',  label: 'Stocks', color: '#9333ea' },
  { key: 'etf_total',    label: 'ETFs',   color: '#d97706' },
]

const INDIVIDUAL_CHARTS = [
  { key: 'bank_balance', label: 'Bank Balance',  color: '#16a34a' },
  { key: 'hysa_balance', label: 'HYSA Balance',  color: '#2563eb' },
  { key: 'stock_value',  label: 'Stock Value',   color: '#9333ea' },
  { key: 'etf_total',    label: 'ETF Total',     color: '#d97706' },
]

function makeStackedChart(history, theme) {
  const tickColor = theme === 'dark' ? '#a1a1aa' : '#71717a'
  const gridColor = theme === 'dark' ? '#27272a' : '#e4e4e7'
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
        legend: { display: true, position: 'top', labels: { color: tickColor, boxWidth: 12, padding: 16 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: $${fmt(ctx.parsed.y)}`,
            footer: items => `  Net Worth: $${fmt(items.reduce((s, i) => s + i.parsed.y, 0))}`,
          },
        },
      },
      scales: {
        x: { stacked: true, ticks: { color: tickColor }, grid: { color: gridColor } },
        y: { stacked: true, beginAtZero: true, ticks: { color: tickColor, callback: v => '$' + fmt(v) }, grid: { color: gridColor } },
      },
    },
  }
}

function makeLineChart(history, key, color, theme) {
  const tickColor = theme === 'dark' ? '#a1a1aa' : '#71717a'
  const gridColor = theme === 'dark' ? '#27272a' : '#e4e4e7'
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
        y: { beginAtZero: false, ticks: { color: tickColor, callback: v => '$' + fmt(v) }, grid: { color: gridColor } },
        x: { ticks: { color: tickColor }, grid: { color: gridColor } },
      },
    },
  }
}

export default function PortfolioStats() {
  const [history, setHistory] = useState([])
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'light')

  useEffect(() => {
    getInvestmentHistory().then(setHistory)
  }, [])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'light')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
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
  const stacked = makeStackedChart(history, theme)

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

      {INDIVIDUAL_CHARTS.map(({ key, label, color }) => {
        const { data, options } = makeLineChart(history, key, color, theme)
        return (
          <div key={key} className="card chart-card">
            <div className="card-header"><h2>{label}</h2></div>
            <div className="chart-container">
              <Line data={data} options={options} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
