import { useState, useEffect } from 'react'
import { getInvestments, fetchStockPrices, upsertStock, removeStock, updateStockValue, addStockSale } from '../lib/api'
import { fmt } from '../lib/utils'

function SellModal({ ticker, onConfirm, onClose }) {
  const [gain, setGain] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const val = parseFloat(gain)
    if (isNaN(val)) { setError('Enter the gain or loss in dollars'); return }
    onConfirm(val)
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Sell {ticker}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="inv-desc">Enter how much you gained or lost on this sale. Use a negative number for a loss.</p>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Gain / loss ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={gain}
                onChange={e => { setGain(e.target.value); setError('') }}
                autoFocus
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary">Record Sale</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function Stocks() {
  const [stocks, setStocks] = useState([])
  const [prices, setPrices] = useState({})
  const [realizedGains, setRealizedGains] = useState(0)
  const [pricesLoading, setPricesLoading] = useState(false)
  const [pricesError, setPricesError] = useState(null)
  const [tickerInput, setTickerInput] = useState('')
  const [sharesInput, setSharesInput] = useState('')
  const [saveLabel, setSaveLabel] = useState('Add Stock')
  const [sellStock, setSellStock] = useState(null)

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
    setRealizedGains(data.stock_realized_gains || 0)
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

  async function handleSellConfirm(gain) {
    await addStockSale(sellStock.ticker, gain)
    setSellStock(null)
    load()
  }

  function prefill(ticker, shares) {
    setTickerInput(ticker)
    setSharesInput(String(shares))
    setSaveLabel(`Update ${ticker}`)
  }

  function clearForm() {
    setTickerInput('')
    setSharesInput('')
    setSaveLabel('Add Stock')
  }

  const isEditing = saveLabel !== 'Add Stock'
  const totalValue = stocks.reduce((sum, { ticker, shares }) => sum + shares * (prices[ticker] || 0), 0)

  return (
    <>
      {sellStock && (
        <SellModal
          ticker={sellStock.ticker}
          onConfirm={handleSellConfirm}
          onClose={() => setSellStock(null)}
        />
      )}

      <div className="summary-grid two-col mb-24">
        <div className="stat-card">
          <div className="stat-label">Total Stock Value</div>
          <div className="stat-value">{pricesLoading ? '...' : `$${fmt(totalValue)}`}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Realized Gains</div>
          <div className="stat-value" style={{ color: realizedGains >= 0 ? 'var(--income)' : 'var(--expense)' }}>
            {realizedGains >= 0 ? '+' : ''}{`$${fmt(Math.abs(realizedGains))}`}
          </div>
        </div>
      </div>

      <div className="form-table-layout">
        <div className="card">
          <div className="card-header"><h2>{saveLabel}</h2></div>
          <div className="card-body">
            <p className="inv-desc">Enter a ticker and share count. Prices are fetched live from Yahoo Finance.</p>
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
              <button type="submit" className="btn btn-primary full-width">{saveLabel}</button>
              {isEditing && (
                <button type="button" className="btn full-width mt-6" onClick={clearForm}>Cancel</button>
              )}
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Holdings</h2>
            <button
              className="icon-btn refresh-btn"
              title="Refresh prices"
              disabled={pricesLoading || stocks.length === 0}
              onClick={() => loadPrices(stocks)}
            >
              {pricesLoading ? '⏳' : '↻'}
            </button>
          </div>
          <div className="card-body">
            {pricesError && <p className="error-text">{pricesError}</p>}
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
                          <div className="etf-holding-actions visible">
                            <button className="icon-btn sell-btn" title="Sell" onClick={() => setSellStock({ ticker, shares })}>$</button>
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
