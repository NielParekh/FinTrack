import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { getInvestments, updateInvestments } from '../lib/api'
import { fmt, fmtGain, fmtPct } from '../lib/utils'

ChartJS.register(ArcElement, Tooltip, Legend)

const ALLOC_COLORS = ['#9333ea', '#2563eb', '#d97706', '#16a34a']

function CostBasisCard({ title, description, value, onSave }) {
  const [input, setInput] = useState('')
  const [editing, setEditing] = useState(false)

  function handleEdit() {
    setInput(value > 0 ? String(value) : '')
    setEditing(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await onSave(parseFloat(input) || 0)
    setEditing(false)
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>{title}</h2>
        {!editing && <button className="icon-btn" onClick={handleEdit}>✏️</button>}
      </div>
      <div className="card-body">
        {editing ? (
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>{description}</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={input}
                onChange={e => setInput(e.target.value)}
                autoFocus
              />
            </div>
            <div className="cost-basis-actions">
              <button type="submit" className="btn btn-primary">Save</button>
              <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <p className="inv-desc">
            Cost basis: <strong>${fmt(value)}</strong>
          </p>
        )}
      </div>
    </div>
  )
}

export default function Investments() {
  const [inv, setInv] = useState({
    bank_balance: 0, hysa_balance: 0,
    stock_value: 0, stock_cost_basis: 0,
    hysa_cost_basis: 0, etf_cost_basis: 0,
    etf_total: 0,
  })

  async function load() {
    setInv(await getInvestments())
  }

  useEffect(() => { load() }, [])

  const stockGain = inv.stock_cost_basis > 0 ? inv.stock_value - inv.stock_cost_basis : null
  const hysaGain  = inv.hysa_cost_basis > 0  ? inv.hysa_balance - inv.hysa_cost_basis  : null
  const etfGain   = inv.etf_cost_basis > 0   ? inv.etf_total - inv.etf_cost_basis      : null

  const totalInvested = (inv.stock_cost_basis || 0) + (inv.hysa_cost_basis || 0) + (inv.etf_cost_basis || 0) + inv.bank_balance
  const totalCurrent  = inv.bank_balance + inv.hysa_balance + inv.stock_value + inv.etf_total
  const totalGain     = (stockGain || 0) + (hysaGain || 0) + (etfGain || 0)

  const rows = [
    { label: 'Stocks', invested: inv.stock_cost_basis || null, current: inv.stock_value,   gain: stockGain },
    { label: 'HYSA',   invested: inv.hysa_cost_basis  || null, current: inv.hysa_balance,  gain: hysaGain  },
    { label: 'ETFs',   invested: inv.etf_cost_basis   || null, current: inv.etf_total,     gain: etfGain   },
    { label: 'Bank',   invested: inv.bank_balance,             current: inv.bank_balance,  gain: null      },
  ]

  const summaryCards = [
    { label: 'Net Worth',      value: totalCurrent },
    { label: 'Total Invested', value: totalInvested },
    { label: 'Total Gain',     value: totalGain, isGain: true },
  ]

  const allocSlices = [
    { label: 'Stocks', value: inv.stock_value },
    { label: 'HYSA',   value: inv.hysa_balance },
    { label: 'ETFs',   value: inv.etf_total },
    { label: 'Bank',   value: inv.bank_balance },
  ]

  const allocData = {
    labels: allocSlices.map(s => s.label),
    datasets: [{
      data: allocSlices.map(s => s.value),
      backgroundColor: ALLOC_COLORS,
      borderColor: 'var(--card)',
      borderWidth: 3,
      hoverOffset: 6,
    }]
  }

  const allocOptions = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '60%',
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
  }

  return (
    <>
      <div className="summary-grid inv-summary-grid mb-24">
        {summaryCards.map(({ label, value, isGain }) => {
          const g = isGain ? fmtGain(totalInvested > 0 ? value : null) : null
          return (
            <div key={label} className="stat-card">
              <div className="stat-label">{label}</div>
              <div className={`stat-value ${g ? g.cls : ''}`}>
                {isGain && totalInvested > 0 ? g.text : `$${fmt(value)}`}
              </div>
            </div>
          )
        })}
      </div>

      {totalCurrent > 0 && (
        <div className="card mb-20">
          <div className="card-header"><h2>Asset Allocation</h2></div>
          <div className="card-body">
            <div className="allocation-section">
              <div className="allocation-chart-wrap">
                <Doughnut data={allocData} options={allocOptions} />
              </div>
              <ul className="allocation-legend">
                {allocSlices.map((s, i) => (
                  <li key={s.label} className="allocation-legend-item">
                    <span className="allocation-legend-dot" style={{ background: ALLOC_COLORS[i] }} />
                    <span className="allocation-legend-label">{s.label}</span>
                    <span className="allocation-legend-value">${fmt(s.value)}</span>
                    <span className="allocation-legend-pct">
                      {totalCurrent > 0 ? ((s.value / totalCurrent) * 100).toFixed(1) : '0.0'}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-20">
        <div className="card-header"><h2>Performance</h2></div>
        <div className="card-body no-padding">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Amount Invested</th>
                <th>Current Value</th>
                <th>Gain / Loss</th>
                <th>Return</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ label, invested, current, gain }) => {
                const g = fmtGain(gain)
                return (
                  <tr key={label}>
                    <td><strong>{label}</strong></td>
                    <td className="stock-num">{invested != null ? `$${fmt(invested)}` : '\u2014'}</td>
                    <td className="stock-num">${fmt(current)}</td>
                    <td className={`stock-num ${g.cls}`}>{g.text}</td>
                    <td className="stock-num">{gain != null ? fmtPct(gain, invested) : '\u2014'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="stock-total-row">
                <td><strong>Total</strong></td>
                <td className="stock-num"><strong>{totalInvested > 0 ? `$${fmt(totalInvested)}` : '\u2014'}</strong></td>
                <td className="stock-num"><strong>${fmt(totalCurrent)}</strong></td>
                <td className={`stock-num ${fmtGain(totalInvested > 0 ? totalGain : null).cls}`}>
                  <strong>{fmtGain(totalInvested > 0 ? totalGain : null).text}</strong>
                </td>
                <td className="stock-num">
                  <strong>{totalInvested > 0 ? fmtPct(totalGain, totalInvested) : '\u2014'}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="cost-basis-grid">
        <CostBasisCard
          title="Stock Cost Basis"
          description="Total amount paid for all stock positions ($)"
          value={inv.stock_cost_basis}
          onSave={v => updateInvestments({ stock_cost_basis: v }).then(load)}
        />
        <CostBasisCard
          title="HYSA Cost Basis"
          description="Total amount deposited into your HYSA ($)"
          value={inv.hysa_cost_basis}
          onSave={v => updateInvestments({ hysa_cost_basis: v }).then(load)}
        />
        <CostBasisCard
          title="ETF Cost Basis"
          description="Total amount paid for all ETF positions ($)"
          value={inv.etf_cost_basis}
          onSave={v => updateInvestments({ etf_cost_basis: v }).then(load)}
        />
      </div>
    </>
  )
}
