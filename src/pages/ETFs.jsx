import { useState, useEffect } from 'react'
import { getInvestments, upsertEtf, removeEtf } from '../lib/api'

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ETFs() {
  const [etfs, setEtfs] = useState([])
  const [etfTotal, setEtfTotal] = useState(0)
  const [tickerInput, setTickerInput] = useState('')
  const [valueInput, setValueInput] = useState('')
  const [saveLabel, setSaveLabel] = useState('Add ETF')

  async function load() {
    const data = await getInvestments()
    setEtfs(data.etfs || [])
    setEtfTotal(data.etf_total || 0)
  }

  useEffect(() => { load() }, [])

  async function handleUpsert(e) {
    e.preventDefault()
    if (!tickerInput || !valueInput) return
    await upsertEtf(tickerInput, parseFloat(valueInput))
    setTickerInput('')
    setValueInput('')
    setSaveLabel('Add ETF')
    load()
  }

  async function handleRemove(ticker) {
    if (!window.confirm(`Remove ${ticker}?`)) return
    await removeEtf(ticker)
    load()
  }

  function prefill(ticker, value) {
    setTickerInput(ticker)
    setValueInput(String(value))
    setSaveLabel(`Update ${ticker}`)
  }

  return (
    <>
      <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total ETF Value</div>
          <div className="stat-value">${fmt(etfTotal)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Positions</div>
          <div className="stat-value">{etfs.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Add / Edit form */}
        <div className="card">
          <div className="card-header"><h2>{saveLabel}</h2></div>
          <div className="card-body">
            <p className="inv-desc">Enter a ticker and its current dollar value.</p>
            <form onSubmit={handleUpsert}>
              <div className="input-group">
                <label>Ticker</label>
                <input
                  type="text"
                  placeholder="VOO"
                  value={tickerInput}
                  onChange={e => { setTickerInput(e.target.value.toUpperCase()); setSaveLabel('Add ETF') }}
                />
              </div>
              <div className="input-group">
                <label>Value ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={valueInput}
                  onChange={e => setValueInput(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>{saveLabel}</button>
              {saveLabel !== 'Add ETF' && (
                <button
                  type="button"
                  className="btn"
                  style={{ width: '100%', marginTop: 6 }}
                  onClick={() => { setTickerInput(''); setValueInput(''); setSaveLabel('Add ETF') }}
                >
                  Cancel
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Holdings table */}
        <div className="card">
          <div className="card-header"><h2>Holdings</h2></div>
          <div className="card-body">
            {etfs.length === 0 ? (
              <p className="etf-empty">No ETFs added yet. Use the form to add your first position.</p>
            ) : (
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Value</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {etfs.map(({ ticker, value }) => (
                    <tr key={ticker}>
                      <td><span className="etf-ticker-badge">{ticker}</span></td>
                      <td className="stock-num stock-value-cell">${fmt(value)}</td>
                      <td>
                        <div className="etf-holding-actions" style={{ opacity: 1 }}>
                          <button className="icon-btn" title="Edit" onClick={() => prefill(ticker, value)}>✏️</button>
                          <button className="icon-btn danger" title="Remove" onClick={() => handleRemove(ticker)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {etfs.length > 1 && (
                    <tr className="stock-total-row">
                      <td><strong>Total</strong></td>
                      <td className="stock-num stock-value-cell"><strong>${fmt(etfTotal)}</strong></td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
