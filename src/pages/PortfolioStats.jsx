import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Legend, Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { getInvestmentHistory } from '../lib/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

function makeLineChart(history, key, color, label) {
  return {
    data: {
      labels: history.map(h => h.date),
      datasets: [{
        label,
        data: history.map(h => h[key]),
        borderColor: color,
        backgroundColor: color + '22',
        fill: true,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: false } },
    }
  }
}

const CHARTS = [
  { key: 'net_worth',    color: '#18181b', label: 'Net Worth' },
  { key: 'bank_balance', color: '#16a34a', label: 'Bank Balance' },
  { key: 'hysa_balance', color: '#2563eb', label: 'HYSA Balance' },
  { key: 'stock_value',  color: '#9333ea', label: 'Stock Value' },
  { key: 'etf_total',    color: '#d97706', label: 'ETF Total' },
]

export default function PortfolioStats() {
  const [history, setHistory] = useState([])

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

  return (
    <div className="stats-container">
      {CHARTS.map(({ key, color, label }) => {
        const { data, options } = makeLineChart(history, key, color, label)
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
