import { useState, useEffect } from 'react'
import { getInvestments, updateInvestments, upsertEtf, removeEtf } from '../lib/api'

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Investments() {
  const [inv, setInv] = useState({ bank_balance: 0, hysa_balance: 0, stock_value: 0, etf_total: 0, etfs: [] })
  const [bankInput, setBankInput] = useState('')
  const [hysaInput, setHysaInput] = useState('')
  const [stockInput, setStockInput] = useState('')
  const [etfTicker, setEtfTicker] = useState('')
  const [etfValue, setEtfValue] = useState('')
  const [etfSaveLabel, setEtfSaveLabel] = useState('Add ETF')

  async function load() {
    const data = await getInvestments()
    setInv(data)
  }

  useEffect(() => { load() }, [])

  async function handleUpdateBank(e) {
    e.preventDefault()
    await updateInvestments({ bank_balance: parseFloat(bankInput) || 0, hysa_balance: inv.hysa_balance, stock_value: inv.stock_value })
    setBankInput('')
    load()
  }

  async function handleUpdateHysa(e) {
    e.preventDefault()
    await updateInvestments({ bank_balance: inv.bank_balance, hysa_balance: parseFloat(hysaInput) || 0, stock_value: inv.stock_value })
    setHysaInput('')
    load()
  }

  async function handleUpdateStock(e) {
    e.preventDefault()
    await updateInvestments({ bank_balance: inv.bank_balance, hysa_balance: inv.hysa_balance, stock_value: parseFloat(stockInput) || 0 })
    setStockInput('')
    load()
  }

  async function handleUpsertEtf(e) {
    e.preventDefault()
    await upsertEtf(etfTicker, parseFloat(etfValue) || 0)
    setEtfTicker('')
    setEtfValue('')
    setEtfSaveLabel('Add ETF')
    load()
  }

  async function handleRemoveEtf(ticker) {
    if (!window.confirm(`Remove ${ticker}?`)) return
    await removeEtf(ticker)
    load()
  }

  function prefillEtf(ticker, value) {
    setEtfTicker(ticker)
    setEtfValue(String(value))
    setEtfSaveLabel(`Update ${ticker}`)
  }

  const netWorth = inv.bank_balance + inv.hysa_balance + inv.stock_value + inv.etf_total

  return (
    <>
      <div className="summary-grid inv-summary-grid">
        {[
          { label: 'Bank Balance', value: inv.bank_balance },
          { label: 'HYSA Balance', value: inv.hysa_balance },
          { label: 'Stock Value', value: inv.stock_value },
          { label: 'ETF Total', value: inv.etf_total },
          { label: 'Net Worth', value: netWorth },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value">${fmt(value)}</div>
          </div>
        ))}
      </div>

      <div className="inv-grid">
        {/* Bank */}
        <div className="card">
          <div className="card-header"><h2>Bank</h2></div>
          <div className="card-body">
            <p className="inv-desc">Checking / savings account balance.</p>
            <form onSubmit={handleUpdateBank}>
              <div className="input-group">
                <label>Balance ($)</label>
                <input type="number" step="0.01" placeholder={fmt(inv.bank_balance)} value={bankInput} onChange={e => setBankInput(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Save</button>
            </form>
          </div>
        </div>

        {/* HYSA */}
        <div className="card">
          <div className="card-header"><h2>HYSA</h2></div>
          <div className="card-body">
            <p className="inv-desc">High-yield savings account balance.</p>
            <form onSubmit={handleUpdateHysa}>
              <div className="input-group">
                <label>Balance ($)</label>
                <input type="number" step="0.01" placeholder={fmt(inv.hysa_balance)} value={hysaInput} onChange={e => setHysaInput(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Save</button>
            </form>
          </div>
        </div>

        {/* Stock */}
        <div className="card">
          <div className="card-header"><h2>Stocks</h2></div>
          <div className="card-body">
            <p className="inv-desc">Total value of individual stock holdings.</p>
            <form onSubmit={handleUpdateStock}>
              <div className="input-group">
                <label>Value ($)</label>
                <input type="number" step="0.01" placeholder={fmt(inv.stock_value)} value={stockInput} onChange={e => setStockInput(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Save</button>
            </form>
          </div>
        </div>

        {/* ETF Holdings */}
        <div className="card">
          <div className="card-header"><h2>ETF Holdings</h2></div>
          <div className="card-body">
            <p className="inv-desc">Track individual ETF positions by ticker.</p>
            <form onSubmit={handleUpsertEtf} style={{ marginBottom: 16 }}>
              <div className="form-row">
                <div className="input-group">
                  <label>Ticker</label>
                  <input
                    type="text"
                    placeholder="VOO"
                    value={etfTicker}
                    onChange={e => { setEtfTicker(e.target.value.toUpperCase()); setEtfSaveLabel('Add ETF') }}
                  />
                </div>
                <div className="input-group">
                  <label>Value ($)</label>
                  <input type="number" step="0.01" value={etfValue} onChange={e => setEtfValue(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>{etfSaveLabel}</button>
            </form>

            {inv.etfs.length === 0 ? (
              <p className="etf-empty">No ETFs added yet.</p>
            ) : (
              inv.etfs.map(({ ticker, value }) => (
                <div key={ticker} className="etf-holding-row">
                  <span className="etf-ticker-badge">{ticker}</span>
                  <span className="etf-holding-value">${fmt(value)}</span>
                  <div className="etf-holding-actions">
                    <button className="icon-btn" title="Edit" onClick={() => prefillEtf(ticker, value)}>✏️</button>
                    <button className="icon-btn danger" title="Remove" onClick={() => handleRemoveEtf(ticker)}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
