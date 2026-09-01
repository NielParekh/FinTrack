import { useState, useEffect, useMemo } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { getSpendingTransactions, getSpendingCategories, getSpendingAccounts, setTransactionCategory, setTransactionSplit } from '../lib/api'
import { fmt, isPurchase, monthKey, myShare } from '../lib/utils'

ChartJS.register(ArcElement, Tooltip, Legend)

const CHART_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#64748b',
]

export default function Spending() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [month, setMonth] = useState(monthKey(new Date().toISOString()))
  const [error, setError] = useState('')
  const [splitDraft, setSplitDraft] = useState({})

  async function load() {
    try {
      const [txs, cats, linked] = await Promise.all([
        getSpendingTransactions(), getSpendingCategories(), getSpendingAccounts(),
      ])
      setTransactions(txs)
      setCategories(cats)
      setItems(linked)
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

  // account_id → "Chase ••1234" for the Card column
  const cardByAccount = useMemo(() => {
    const map = {}
    for (const item of items) {
      for (const a of item.accounts) {
        map[a.id] = `${item.institution}${a.mask ? ` ••${a.mask}` : ''}`
      }
    }
    return map
  }, [items])

  const monthTxs = useMemo(
    () => transactions.filter(t => monthKey(t.date) === month),
    [transactions, month]
  )

  // Leaving a month abandons any half-typed split along with it
  useEffect(() => { setSplitDraft({}) }, [month])

  const spendTxs = monthTxs.filter(isPurchase)
  const splitCount = spendTxs.filter(t => t.split_ways > 1).length
  const notMineCount = spendTxs.filter(t => t.split_ways === 0).length
  const totalSpend = spendTxs.reduce((s, t) => s + myShare(t), 0)

  const byCategory = useMemo(() => {
    const totals = {}
    for (const t of spendTxs) totals[t.category] = (totals[t.category] || 0) + myShare(t)
    return Object.entries(totals).sort((a, b) => b[1] - a[1])
  }, [spendTxs])

  // The split box is controlled by a per-transaction draft so a re-render
  // (a sync landing, the list re-ordering) can never carry a typed value
  // onto a different row. Blur commits only a value the user actually
  // changed, and anything invalid snaps back to what's stored.
  async function commitSplit(tx) {
    const draft = splitDraft[tx.id]
    if (draft === undefined) return
    setSplitDraft(d => { const { [tx.id]: _, ...rest } = d; return rest })

    if (String(draft).trim() === '') return
    const ways = Number(draft)
    const current = tx.split_ways ?? 1
    if (!Number.isInteger(ways) || ways < 0 || ways === current) return

    try {
      await setTransactionSplit(tx.id, ways)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

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
            <p className="muted-cell">
              {spendTxs.length - notMineCount} purchases · card payments excluded
              {splitCount > 0 && ` · ${splitCount} split`}
              {notMineCount > 0 && ` · ${notMineCount} not mine`}
            </p>
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
                  <th>Card</th>
                  <th>Category</th>
                  <th>Split</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {monthTxs.map(tx => (
                  <tr key={tx.id} className={tx.pending ? 'tx-pending' : ''}>
                    <td className="muted-cell">{tx.date}{tx.pending ? ' ⏳' : ''}</td>
                    <td>{tx.merchant}</td>
                    <td className="muted-cell">{cardByAccount[tx.account_id] || '—'}</td>
                    <td>
                      <select
                        className="category-select"
                        value={tx.category}
                        onChange={e => handleCategoryChange(tx, e.target.value)}
                      >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="split-cell">
                      {isPurchase(tx) ? (
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="split-input"
                          value={splitDraft[tx.id] ?? tx.split_ways ?? 1}
                          title="How many people this expense covered"
                          onChange={e => setSplitDraft(d => ({ ...d, [tx.id]: e.target.value }))}
                          onBlur={() => commitSplit(tx)}
                          onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                        />
                      ) : '—'}
                    </td>
                    <td className={`stock-num ${tx.split_ways === 0 ? 'muted-cell' : tx.amount > 0 ? 'expense' : 'hysa-pos'}`}>
                      {tx.split_ways === 0
                        ? '$0.00'
                        : `${tx.amount > 0 ? '-' : '+'}$${fmt(Math.abs(myShare(tx)))}`}
                      {tx.split_ways === 0 ? (
                        <span className="split-full" title={`Full charge $${fmt(tx.amount)}, reimbursed in full`}>
                          of ${fmt(tx.amount)} · not mine
                        </span>
                      ) : tx.split_ways > 1 && (
                        <span className="split-full" title={`Full charge $${fmt(tx.amount)}, split ${tx.split_ways} ways`}>
                          of ${fmt(tx.amount)}
                        </span>
                      )}
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
