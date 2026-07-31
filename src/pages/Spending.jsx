import { useState, useEffect, useMemo } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { getSpendingTransactions, getSpendingCategories, setTransactionCategory } from '../lib/api'
import { fmt } from '../lib/utils'

ChartJS.register(ArcElement, Tooltip, Legend)

const CHART_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#64748b',
]

// Card payments/transfers are money moving, not money spent
const NON_SPEND = new Set(['Payments'])

function monthKey(date) {
  return date.slice(0, 7) // YYYY-MM
}

export default function Spending() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [month, setMonth] = useState(monthKey(new Date().toISOString()))
  const [error, setError] = useState('')

  async function load() {
    try {
      const [txs, cats] = await Promise.all([getSpendingTransactions(), getSpendingCategories()])
      setTransactions(txs)
      setCategories(cats)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { load() }, [])

  const months = useMemo(() => {
    const set = new Set(transactions.map(t => monthKey(t.date)))
    set.add(monthKey(new Date().toISOString()))
    return [...set].sort().reverse()
  }, [transactions])

  const monthTxs = useMemo(
    () => transactions.filter(t => monthKey(t.date) === month),
    [transactions, month]
  )

  // Spend = positive amounts (money out), excluding card payments/transfers
  const spendTxs = monthTxs.filter(t => t.amount > 0 && !NON_SPEND.has(t.category))
  const totalSpend = spendTxs.reduce((s, t) => s + t.amount, 0)

  const byCategory = useMemo(() => {
    const totals = {}
    for (const t of spendTxs) totals[t.category] = (totals[t.category] || 0) + t.amount
    return Object.entries(totals).sort((a, b) => b[1] - a[1])
  }, [spendTxs])

  async function handleCategoryChange(tx, category) {
    try {
      const remember = confirm(`Always categorize “${tx.merchant}” as ${category}?`)
      await setTransactionCategory(tx.id, category, remember)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const chart = {
    data: {
      labels: byCategory.map(([c]) => c),
      datasets: [{
        data: byCategory.map(([, v]) => v),
        backgroundColor: CHART_COLORS.slice(0, byCategory.length),
        borderWidth: 0,
      }],
    },
    options: {
      plugins: {
        legend: { position: 'right' },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: $${fmt(ctx.parsed)}` } },
      },
      maintainAspectRatio: false,
    },
  }

  if (transactions.length === 0) {
    return (
      <div className="card">
        <div className="card-header"><h2>Spending Overview</h2></div>
        <div className="card-body">
          {error && <p className="error-banner">⚠️ {error}</p>}
          <p className="etf-empty">No spending data yet. Link a card under “Linked Cards” to get started.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-grid">
      {error && <div className="card"><div className="card-body error-banner">⚠️ {error}</div></div>}

      <div className="spending-summary-row">
        <div className="card">
          <div className="card-header">
            <h2>Monthly Spend</h2>
            <select className="month-select" value={month} onChange={e => setMonth(e.target.value)}>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="card-body">
            <div className="spend-total">${fmt(totalSpend)}</div>
            <p className="muted-cell">{spendTxs.length} purchases · card payments excluded</p>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2>By Category</h2></div>
          <div className="card-body">
            {byCategory.length === 0 ? (
              <p className="etf-empty">No purchases this month.</p>
            ) : (
              <div className="spend-chart"><Doughnut data={chart.data} options={chart.options} /></div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2>Transactions — {month}</h2></div>
        <div className="card-body">
          {monthTxs.length === 0 ? (
            <p className="etf-empty">No transactions this month.</p>
          ) : (
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {monthTxs.map(tx => (
                  <tr key={tx.id} className={tx.pending ? 'tx-pending' : ''}>
                    <td className="muted-cell">{tx.date}{tx.pending ? ' ⏳' : ''}</td>
                    <td>{tx.merchant}</td>
                    <td>
                      <select
                        className="category-select"
                        value={tx.category}
                        onChange={e => handleCategoryChange(tx, e.target.value)}
                      >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className={`stock-num ${tx.amount > 0 ? 'expense' : 'hysa-pos'}`}>
                      {tx.amount > 0 ? '-' : '+'}${fmt(Math.abs(tx.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
