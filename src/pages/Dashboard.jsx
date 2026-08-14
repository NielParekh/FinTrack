import { useState, useEffect, useMemo } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js'
import { Line } from 'react-chartjs-2'
import {
  getInvestments, getInvestmentHistory, getSpendingTransactions, getSpendingAccounts,
  syncTransactions,
} from '../lib/api'
import { fmt, fmtGain, fmtPct, isPurchase, monthKey } from '../lib/utils'
import { useTheme } from '../lib/useTheme'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const RANGES = [
  { id: '1m', label: '1M', days: 30 },
  { id: '6m', label: '6M', days: 182 },
  { id: '1y', label: '1Y', days: 365 },
  { id: 'all', label: 'All', days: null },
]

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Dashboard({ setActiveTab }) {
  const [inv, setInv] = useState(null)
  const [history, setHistory] = useState([])
  const [transactions, setTransactions] = useState([])
  const [cards, setCards] = useState([])
  const [range, setRange] = useState('6m')
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const { colors } = useTheme()

  async function load() {
    const [i, h, txs, accts] = await Promise.all([
      getInvestments(), getInvestmentHistory(),
      getSpendingTransactions(), getSpendingAccounts(),
    ])
    setInv(i)
    setHistory(h)
    setTransactions(txs)
    setCards(accts)
  }

  useEffect(() => {
    load().catch(err => setError(err.message))
  }, [])

  async function handleSyncCards() {
    setError('')
    setSyncMsg('Syncing…')
    setSyncing(true)
    try {
      const res = await syncTransactions()
      const parts = [`${res.added} new`, `${res.modified} updated`]
      if (res.removed) parts.push(`${res.removed} removed`)
      setSyncMsg(`Sync complete: ${parts.join(', ')}.`)
      if (res.errors?.length) setError(res.errors.join(' · '))
      await load()
    } catch (err) {
      setError(err.message)
      setSyncMsg('')
    } finally {
      setSyncing(false)
    }
  }

  const thisMonth = monthKey(new Date().toISOString())
  const lastMonth = shiftMonth(thisMonth, -1)

  const spend = useMemo(() => {
    const totals = {}
    for (const t of transactions) {
      if (!isPurchase(t)) continue
      const m = monthKey(t.date)
      totals[m] = (totals[m] || 0) + t.amount
    }
    return totals
  }, [transactions])

  const rangedHistory = useMemo(() => {
    const days = RANGES.find(r => r.id === range)?.days
    if (!days) return history
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const iso = cutoff.toISOString().slice(0, 10)
    const windowed = history.filter(h => h.date >= iso)
    // Always keep enough points to draw a line
    return windowed.length > 1 ? windowed : history.slice(-2)
  }, [history, range])

  // Only blank the page when the initial load failed; a sync error still has
  // a rendered dashboard to sit inside, so it shows inline under Connections.
  if (error && !inv) {
    return <div className="card"><div className="card-body error-banner">⚠️ {error}</div></div>
  }
  if (!inv) return null

  const netWorth = history.length ? history[history.length - 1].net_worth || 0 : 0
  const first = rangedHistory.length ? rangedHistory[0].net_worth || 0 : 0
  const change = netWorth - first
  const changePct = first > 0 ? (change / first) * 100 : null

  const invested = (inv.stock_cost_basis || 0) + (inv.hysa_cost_basis || 0) +
    (inv.etf_cost_basis || 0) + (inv.bank_balance || 0)
  const current = (inv.bank_balance || 0) + (inv.hysa_balance || 0) +
    (inv.stock_value || 0) + (inv.etf_total || 0)
  const portfolioGain = invested > 0 ? current - invested : null

  const thisSpend = spend[thisMonth] || 0
  const lastSpend = spend[lastMonth] || 0
  const spendDelta = lastSpend > 0 ? thisSpend - lastSpend : null

  const cash = (inv.bank_balance || 0) + (inv.hysa_balance || 0)

  const lineColor = change >= 0 ? '#16a34a' : '#dc2626'

  const chart = {
    data: {
      labels: rangedHistory.map(h => h.date),
      datasets: [{
        data: rangedHistory.map(h => h.net_worth || 0),
        borderColor: lineColor,
        backgroundColor: lineColor + '1a',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` $${fmt(ctx.parsed.y)}` } },
      },
      scales: {
        x: { ticks: { color: colors.tick, maxTicksLimit: 6 }, grid: { display: false } },
        y: { ticks: { color: colors.tick, callback: v => '$' + fmt(v) }, grid: { color: colors.grid } },
      },
    },
  }

  const g = fmtGain(portfolioGain)
  const recent = transactions.filter(isPurchase).slice(0, 5)

  const tiles = [
    {
      label: 'Portfolio Gain',
      value: portfolioGain != null ? g.text : '—',
      cls: portfolioGain != null ? g.cls : '',
      sub: portfolioGain != null ? fmtPct(portfolioGain, invested) + ' all time' : null,
      tab: 'investments',
    },
    {
      label: `Spent in ${thisMonth}`,
      value: `$${fmt(thisSpend)}`,
      cls: '',
      sub: spendDelta != null
        ? `${spendDelta >= 0 ? '+' : '−'}$${fmt(Math.abs(spendDelta))} vs last month`
        : 'no prior month',
      tab: 'spending',
    },
    {
      label: 'Cash',
      value: `$${fmt(cash)}`,
      cls: '',
      sub: `bank + HYSA`,
      tab: 'hysa',
    },
    {
      label: 'Invested',
      value: `$${fmt((inv.stock_value || 0) + (inv.etf_total || 0))}`,
      cls: '',
      sub: 'stocks + ETFs',
      tab: 'etfs',
    },
  ]

  return (
    <div className="page-grid">
      <div className="card">
        <div className="card-header">
          <h2>Net Worth</h2>
          <div className="range-toggle">
            {RANGES.map(r => (
              <button
                key={r.id}
                className={`range-btn${range === r.id ? ' active' : ''}`}
                onClick={() => setRange(r.id)}
              >{r.label}</button>
            ))}
          </div>
        </div>
        <div className="card-body">
          <div className="hero-figure">${fmt(netWorth)}</div>
          <div className={`hero-delta ${change >= 0 ? 'gain-pos' : 'gain-neg'}`}>
            {change >= 0 ? '↑' : '↓'} ${fmt(Math.abs(change))}
            {changePct != null && ` (${change >= 0 ? '+' : '−'}${Math.abs(changePct).toFixed(1)}%)`}
            <span className="muted-cell"> over {RANGES.find(r => r.id === range).label.toLowerCase()}</span>
          </div>
          <div className="hero-chart">
            <Line data={chart.data} options={chart.options} />
          </div>
        </div>
      </div>

      <div className="summary-grid four-col">
        {tiles.map(t => (
          <button key={t.label} className="stat-card stat-card--link" onClick={() => setActiveTab(t.tab)}>
            <div className="stat-label">{t.label}</div>
            <div className={`stat-value ${t.cls}`}>{t.value}</div>
            {t.sub && <div className="stat-sub muted-cell">{t.sub}</div>}
          </button>
        ))}
      </div>

      <div className="dash-split">
        <div className="card">
          <div className="card-header"><h2>Recent Purchases</h2></div>
          <div className="card-body">
            {recent.length === 0 ? (
              <p className="etf-empty">No transactions yet.</p>
            ) : (
              <table className="stock-table">
                <tbody>
                  {recent.map(t => (
                    <tr key={t.id}>
                      <td className="muted-cell">{t.date}</td>
                      <td>{t.merchant}</td>
                      <td className="muted-cell">{t.category}</td>
                      <td className="stock-num expense">${fmt(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="link-actions">
              <button className="btn btn-secondary" onClick={() => setActiveTab('spending')}>
                View all spending
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2>Connections</h2></div>
          <div className="card-body">
            {cards.length === 0 ? (
              <p className="etf-empty">No cards linked.</p>
            ) : (
              <ul className="conn-list">
                {cards.map(c => (
                  <li key={c.item_id} className="conn-item">
                    <span className={`conn-dot ${c.status === 'ok' ? 'ok' : 'bad'}`} />
                    <span className="conn-name">{c.institution}</span>
                    <span className="muted-cell conn-time">
                      {c.last_synced ? new Date(c.last_synced).toLocaleDateString() : 'never synced'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="link-actions">
              {cards.length > 0 && (
                <button className="btn btn-secondary" onClick={handleSyncCards} disabled={syncing}>
                  {syncing ? 'Syncing…' : '⟳ Sync cards'}
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setActiveTab('spending-accounts')}>
                Manage cards
              </button>
            </div>
            {syncMsg && <p className="muted-cell sync-status">{syncMsg}</p>}
            {error && <p className="error-banner sync-status">⚠️ {error}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
