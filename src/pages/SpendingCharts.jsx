import { useState, useEffect, useMemo } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { getSpendingTransactions, getSpendingAccounts } from '../lib/api'
import { fmt, isPurchase, monthKey } from '../lib/utils'
import { useTheme } from '../lib/useTheme'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

// Bars carry their own accent/dim pair for the filter emphasis, on top of
// the shared axis colors.
const BAR_PALETTE = {
  light: { accent: '#2a78d6', dim: '#d6d5cd' },
  dark:  { accent: '#3987e5', dim: '#44443f' },
}

export default function SpendingCharts() {
  const [transactions, setTransactions] = useState([])
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [month, setMonth] = useState('all')
  const [card, setCard] = useState('all')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    (async () => {
      try {
        const [txs, linked] = await Promise.all([getSpendingTransactions(), getSpendingAccounts()])
        setTransactions(txs)
        setItems(linked)
      } catch (err) {
        setError(err.message)
      }
    })()
  }, [])

  const { theme, colors: axis } = useTheme()
  const colors = { ...axis, ...BAR_PALETTE[theme] }

  const cardOptions = useMemo(
    () => items.map(i => ({ id: i.item_id, label: i.institution })),
    [items]
  )
  const accountToItem = useMemo(() => {
    const map = {}
    for (const item of items) for (const a of item.accounts) map[a.id] = item.item_id
    return map
  }, [items])

  // Purchases only, then narrowed by the card filter
  const spendTxs = useMemo(
    () => transactions.filter(t =>
      isPurchase(t) && (card === 'all' || accountToItem[t.account_id] === card)
    ),
    [transactions, card, accountToItem]
  )

  const months = useMemo(
    () => [...new Set(spendTxs.map(t => monthKey(t.date)))].sort(),
    [spendTxs]
  )
  const categoryOptions = useMemo(
    () => [...new Set(spendTxs.map(t => t.category))].sort(),
    [spendTxs]
  )

  const byMonth = useMemo(() => {
    const totals = {}
    for (const t of spendTxs) {
      if (category !== 'all' && t.category !== category) continue
      const m = monthKey(t.date)
      totals[m] = (totals[m] || 0) + t.amount
    }
    return months.map(m => [m, totals[m] || 0])
  }, [spendTxs, months, category])

  const monthCardTxs = useMemo(
    () => spendTxs.filter(t => month === 'all' || monthKey(t.date) === month),
    [spendTxs, month]
  )

  const byCategory = useMemo(() => {
    const totals = {}
    for (const t of monthCardTxs) totals[t.category] = (totals[t.category] || 0) + t.amount
    return Object.entries(totals).sort((a, b) => b[1] - a[1])
  }, [monthCardTxs])

  const topMerchants = useMemo(() => {
    const totals = {}
    for (const t of monthCardTxs) {
      if (category !== 'all' && t.category !== category) continue
      totals[t.merchant] = (totals[t.merchant] || 0) + t.amount
    }
    return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [monthCardTxs, category])

  function barOptions(horizontal) {
    const money = { color: colors.tick, callback: v => '$' + fmt(v) }
    const plain = { color: colors.tick }
    return {
      indexAxis: horizontal ? 'y' : 'x',
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` $${fmt(horizontal ? ctx.parsed.x : ctx.parsed.y)}` } },
      },
      scales: {
        x: horizontal
          ? { ticks: money, grid: { color: colors.grid } }
          : { ticks: plain, grid: { display: false } },
        y: horizontal
          ? { ticks: plain, grid: { display: false } }
          : { ticks: money, grid: { color: colors.grid } },
      },
    }
  }

  // Emphasis: with a filter active, its bar keeps the accent and the rest recede
  function barData(entries, emphasize) {
    return {
      labels: entries.map(([k]) => k),
      datasets: [{
        data: entries.map(([, v]) => v),
        backgroundColor: entries.map(([k]) =>
          emphasize === 'all' || k === emphasize ? colors.accent : colors.dim
        ),
        borderRadius: 4,
        maxBarThickness: 28,
      }],
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="card">
        <div className="card-header"><h2>Spending Charts</h2></div>
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

      <div className="card">
        <div className="card-body chart-filters">
          <label>
            Month
            <select className="month-select" value={month} onChange={e => setMonth(e.target.value)}>
              <option value="all">All months</option>
              {[...months].reverse().map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label>
            Card
            <select className="month-select" value={card} onChange={e => setCard(e.target.value)}>
              <option value="all">All cards</option>
              {cardOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label>
            Category
            <select className="month-select" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <span className="muted-cell chart-filters-note">Purchases only — payments &amp; refunds excluded</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2>Spend by Month{category !== 'all' ? ` — ${category}` : ''}</h2></div>
        <div className="card-body">
          <div className="chart-tall">
            <Bar data={barData(byMonth, month)} options={barOptions(false)} />
          </div>
        </div>
      </div>

      <div className="spending-summary-row">
        <div className="card">
          <div className="card-header"><h2>By Category{month !== 'all' ? ` — ${month}` : ''}</h2></div>
          <div className="card-body">
            {byCategory.length === 0 ? (
              <p className="etf-empty">No purchases match these filters.</p>
            ) : (
              <div className="chart-tall">
                <Bar data={barData(byCategory, category)} options={barOptions(true)} />
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2>Top Merchants{month !== 'all' ? ` — ${month}` : ''}</h2></div>
          <div className="card-body">
            {topMerchants.length === 0 ? (
              <p className="etf-empty">No purchases match these filters.</p>
            ) : (
              <div className="chart-tall">
                <Bar data={barData(topMerchants, 'all')} options={barOptions(true)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
