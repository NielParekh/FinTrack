import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, Tooltip, Legend, Filler
} from 'chart.js'
import { Line, Pie } from 'react-chartjs-2'
import { getExpenses } from '../lib/api'
import { ALLOWED_CATEGORIES } from '../lib/constants'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler)

const CATEGORY_COLORS = {
  Food: '#FF7623',
  Rent: '#02458D',
  Travel: '#16a34a',
  Misc: '#9333ea',
}

export default function Stats() {
  const [expenses, setExpenses] = useState([])

  useEffect(() => {
    getExpenses().then(setExpenses)
  }, [])

  // Monthly totals
  const monthlyMap = {}
  for (const exp of expenses) {
    const month = exp.date.slice(0, 7)
    monthlyMap[month] = (monthlyMap[month] || 0) + exp.amount
  }
  const sortedMonths = Object.keys(monthlyMap).sort()
  const monthlyTotals = sortedMonths.map(m => monthlyMap[m])

  // Cumulative
  let running = 0
  const cumulativeData = sortedMonths.map(m => {
    running += monthlyMap[m]
    return running
  })

  // By category (pie)
  const categoryTotals = {}
  for (const exp of expenses) {
    categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount
  }

  // Category over time (stacked)
  const catMonthly = {}
  for (const cat of ALLOWED_CATEGORIES) {
    catMonthly[cat] = sortedMonths.map(() => 0)
  }
  for (const exp of expenses) {
    const month = exp.date.slice(0, 7)
    const idx = sortedMonths.indexOf(month)
    if (idx !== -1 && catMonthly[exp.category] !== undefined) {
      catMonthly[exp.category][idx] += exp.amount
    }
  }

  const lineOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
  }

  return (
    <div className="stats-container">
      {/* Monthly Expenses */}
      <div className="card chart-card">
        <div className="card-header"><h2>Monthly Expenses Over Time</h2></div>
        <div className="chart-container">
          <Line
            data={{
              labels: sortedMonths,
              datasets: [{
                data: monthlyTotals,
                borderColor: '#FF7623',
                backgroundColor: 'rgba(255,118,35,0.1)',
                fill: true,
                tension: 0.3,
              }]
            }}
            options={lineOpts}
          />
        </div>
      </div>

      {/* Pie by category */}
      <div className="card chart-card">
        <div className="card-header"><h2>Expenses by Category</h2></div>
        <div className="chart-container">
          <Pie
            data={{
              labels: ALLOWED_CATEGORIES,
              datasets: [{
                data: ALLOWED_CATEGORIES.map(c => categoryTotals[c] || 0),
                backgroundColor: ALLOWED_CATEGORIES.map(c => CATEGORY_COLORS[c]),
              }]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'right' } },
            }}
          />
        </div>
      </div>

      {/* Cumulative */}
      <div className="card chart-card">
        <div className="card-header"><h2>Cumulative Spending</h2></div>
        <div className="chart-container">
          <Line
            data={{
              labels: sortedMonths,
              datasets: [{
                data: cumulativeData,
                borderColor: '#02458D',
                backgroundColor: 'rgba(2,69,141,0.1)',
                fill: true,
                tension: 0.3,
              }]
            }}
            options={lineOpts}
          />
        </div>
      </div>

      {/* Category over time */}
      <div className="card chart-card">
        <div className="card-header"><h2>Category Spending Over Time</h2></div>
        <div className="chart-container">
          <Line
            data={{
              labels: sortedMonths,
              datasets: ALLOWED_CATEGORIES.map(cat => ({
                label: cat,
                data: catMonthly[cat],
                borderColor: CATEGORY_COLORS[cat],
                backgroundColor: CATEGORY_COLORS[cat] + '33',
                fill: true,
                tension: 0.3,
              }))
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: true } },
              scales: { y: { beginAtZero: true, stacked: true } },
            }}
          />
        </div>
      </div>
    </div>
  )
}
