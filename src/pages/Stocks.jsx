import { useState, useEffect } from 'react'
import { getInvestments, fetchStockPrices, upsertStock, removeStock, updateStockValue } from '../lib/api'

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Stocks() {
  const [stocks, setStocks] = useState([])
  const [prices, setPrices] = useState({})
  const [pricesLoading, setPricesLoading] = useState(false)
  const [pricesError, setPricesError] = useState(null)
  const [tickerInput, setTickerInput] = useState('')
  const [sharesInput, setSharesInput] = useState('')
  const [saveLabel, setSaveLabel] = useState('Add Stock')

  async function loadPrices(positions) {
    if (!positions.length) return
    setPricesLoading(true)
    setPricesError(null)
    try {
      const tickers = positions.map(s => s.ticker)
      const priceMap = await fetchStockPrices(tickers)
      setPrices(priceMap)
      const total = positions.reduce((sum, { ticker, shares }) => sum + shares * (priceMap[ticker] || 0), 0)
      await updateStockValue(total)
    } catch {
      setPricesError('Failed to fetch prices — check your connection.')
    } finally {
      setPricesLoading(false)
    }
  }

  async function load() {
    const data = await getInvestments()
    const positions = data.stocks || []
    setStocks(positions)
    await loadPrices(positions)
  }

  useEffect(() => { load() }, [])

  async function handleUpsert(e) {
    e.preventDefault()
    if (!tickerInput || !sharesInput) return
    await upsertStock(tickerInput, parseFloat(sharesInput))
    setTickerInput('')
    setSharesInput('')
    setSaveLabel('Add Stock')
    load()
  }

  async function handleRemove(ticker) {
    if (!window.confirm(`Remove ${ticker}?`)) return
    await removeStock(ticker)
    load()
  }

  function prefill(ticker, shares) {
    setTickerInput(ticker)
    setSharesInput(String(shares))
    setSaveLabel(`Update ${ticker}`)
  }

  const totalValue = stocks.reduce((sum, { ticker, shares }) => sum + shares * (prices[ticker] || 0), 0)

  return (
    <>
      <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Stock Value</div>
          <div className="stat-value">{pricesLoading ? '...' : `$${fmt(totalValue)}`}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Positions</div>
          <div className="stat-value">{stocks.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Prices</div>
          <div className="stat-value" style={{ fontSize: '0.95rem' }}>
            {pricesLoading ? 'Fetching...' : pricesError ? 'Error' : stocks.length === 0 ? '—' : 'Live'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Add / Edit form */}
        <div className="card">
          <div className="card-header"><h2>{saveLabel}</h2></div>
          <div className="card-body">
            <p className="inv-desc">Enter a ticker and your share count. Prices are fetched live from Yahoo Finance.</p>
            <form onSubmit={handleUpsert}>
              <div className="input-group">
                <label>Ticker</label>
                <input
                  type="text"
                  placeholder="AAPL"
                  value={tickerInput}
                  onChange={e => { setTickerInput(e.target.value.toUpperCase()); setSaveLabel('Add Stock') }}
                />
              </div>
              <div className="input-group">
                <label>Shares</label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="0"
                  value={sharesInput}
                  onChange={e => setSharesInput(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>{saveLabel}</button>
              {saveLabel !== 'Add Stock' && (
                <button
                  type="button"
                  className="btn"
                  style={{ width: '100%', marginTop: 6 }}
                  onClick={() => { setTickerInput(''); setSharesInput(''); setSaveLabel('Add Stock') }}
                >
                  Cancel
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Holdings table */}
        <div className="card">
          <div className="card-header">
            <h2>Holdings</h2>
            <button
              className="icon-btn"
              title="Refresh prices"
              disabled={pricesLoading || stocks.length === 0}
              onClick={() => loadPrices(stocks)}
              style={{ fontSize: 16, opacity: stocks.length === 0 ? 0.3 : 1 }}
            >
              {pricesLoading ? '⏳' : '↻'}
            </button>
          </div>
          <div className="card-body">
            {pricesError && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: 12 }}>{pricesError}</p>
            )}
            {stocks.length === 0 ? (
              <p className="etf-empty">No stocks added yet. Use the form to add your first position.</p>
            ) : (
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Shares</th>
                    <th>Live Price</th>
                    <th>Value</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map(({ ticker, shares }) => {
                    const price = prices[ticker]
                    const value = price != null ? shares * price : null
                    return (
                      <tr key={ticker}>
                        <td><span className="etf-ticker-badge">{ticker}</span></td>
                        <td className="stock-num">{shares}</td>
                        <td className="stock-num">
                          {price != null ? `$${fmt(price)}` : pricesLoading ? '...' : 'N/A'}
                        </td>
                        <td className="stock-num stock-value-cell">
                          {value != null ? `$${fmt(value)}` : '—'}
                        </td>
                        <td>
                          <div className="etf-holding-actions" style={{ opacity: 1 }}>
                            <button className="icon-btn" title="Edit" onClick={() => prefill(ticker, shares)}>✏️</button>
                            <button className="icon-btn danger" title="Remove" onClick={() => handleRemove(ticker)}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {stocks.length > 1 && (
                    <tr className="stock-total-row">
                      <td colSpan={3}><strong>Total</strong></td>
                      <td className="stock-num stock-value-cell"><strong>${fmt(totalValue)}</strong></td>
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
