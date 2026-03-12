import { useState, useEffect } from 'react'
import { getInvestments, updateInvestments } from '../lib/api'

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtGain(n) {
  if (n == null) return { text: '—', cls: '' }
  const sign = n >= 0 ? '+' : ''
  return { text: `${sign}$${fmt(Math.abs(n))}`, cls: n >= 0 ? 'gain-pos' : 'gain-neg' }
}

function fmtPct(gain, basis) {
  if (!basis) return '—'
  const pct = (gain / basis) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

function CostBasisCard({ title, description, currentValue, value, onSave }) {
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save</button>
              <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setEditing(false)}>Cancel</button>
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

  return (
    <>
      <div className="summary-grid inv-summary-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Net Worth',      value: totalCurrent },
          { label: 'Total Invested', value: totalInvested },
          { label: 'Total Gain',     value: totalGain, isGain: true },
        ].map(({ label, value, isGain }) => {
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

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h2>Performance</h2></div>
        <div className="card-body" style={{ padding: 0 }}>
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
                    <td className="stock-num">{invested != null ? `$${fmt(invested)}` : '—'}</td>
                    <td className="stock-num">${fmt(current)}</td>
                    <td className={`stock-num ${g.cls}`}>{g.text}</td>
                    <td className="stock-num">{gain != null ? fmtPct(gain, invested) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="stock-total-row">
                <td><strong>Total</strong></td>
                <td className="stock-num"><strong>{totalInvested > 0 ? `$${fmt(totalInvested)}` : '—'}</strong></td>
                <td className="stock-num"><strong>${fmt(totalCurrent)}</strong></td>
                <td className={`stock-num ${fmtGain(totalInvested > 0 ? totalGain : null).cls}`}>
                  <strong>{fmtGain(totalInvested > 0 ? totalGain : null).text}</strong>
                </td>
                <td className="stock-num">
                  <strong>{totalInvested > 0 ? fmtPct(totalGain, totalInvested) : '—'}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
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
