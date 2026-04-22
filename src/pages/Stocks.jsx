import { useState, useEffect } from 'react'
import { getInvestments, fetchStockPrices, upsertStock, removeStock, updateStockValue } from '../lib/api'
import { fmt } from '../lib/utils'

export default function Stocks() {
  const [stocks, setStocks] = useState([])
  const [prices, setPrices] = useState({})
  const [pricesLoading, setPricesLoading] = useState(false)
  const [pricesError, setPricesError] = useState(null)
  const [tickerInput, setTickerInput] = useState('')
  const [sharesInput, setSharesInput] = useState('')
  const [investedInput, setInvestedInput] = useState('')
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
    await upsertStock(tickerInput, parseFloat(sharesInput), parseFloat(investedInput) || 0)
    setTickerInput('')
    setSharesInput('')
    setInvestedInput('')
    setSaveLabel('Add Stock')
    load()
  }

  async function handleRemove(ticker) {
    if (!window.confirm(`Remove ${ticker}?`)) return
    await removeStock(ticker)
    load()
  }

  function prefill(ticker, shares, invested) {
    setTickerInput(ticker)
    setSharesInput(String(shares))
    setInvestedInput(invested > 0 ? String(invested) : '')
    setSaveLabel(`Update ${ticker}`)
  }

  function clearForm() {
    setTickerInput('')
    setSharesInput('')
    setInvestedInput('')
    setSaveLabel('Add Stock')
  }

  const isEditing = saveLabel !== 'Add Stock'
  const totalValue = stocks.reduce((sum, { ticker, shares }) => sum + shares * (prices[ticker] || 0), 0)
  const totalInvested = stocks.reduce((sum, { invested }) => sum + (invested || 0), 0)
  const totalGain = totalValue - totalInvested

  return (
    <>
      <div className="summary-grid four-col mb-24">
        <div className="stat-card">
          <div className="stat-label">Total Stock Value</div>
          <div className="stat-value">{pricesLoading ? '...' : `$${fmt(totalValue)}`}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Invested</div>
          <div className="stat-value">{totalInvested > 0 ? `$${fmt(totalInvested)}` : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Profit / Loss</div>
          {pricesLoading ? (
            <div className="stat-value">...</div>
          ) : totalInvested > 0 ? (() => {
            const pct = ((totalGain / totalInvested) * 100).toFixed(1)
            return (
              <div className={`stat-value ${totalGain >= 0 ? 'gain-positive' : 'gain-negative'}`}>
                {totalGain >= 0 ? '+' : ''}{fmt(Math.abs(totalGain))} ({totalGain >= 0 ? '+' : '-'}{Math.abs(pct)}%)
              </div>
            )
          })() : (
            <div className="stat-value">&mdash;</div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">Prices</div>
          <div className="stat-value price-status">
            {pricesLoading ? 'Fetching...' : pricesError ? 'Error' : stocks.length === 0 ? '—' : 'Live'}
          </div>
        </div>
      </div>

      <div className="form-table-layout">
        <div className="card">
          <div className="card-header"><h2>{saveLabel}</h2></div>
          <div className="card-body">
            <p className="inv-desc">Enter a ticker, your share count, and how much you invested. Prices are fetched live from Yahoo Finance.</p>
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
              <div className="input-group">
                <label>Amount Invested ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={investedInput}
                  onChange={e => setInvestedInput(e.target.value)}
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
                    <th>Invested</th>
                    <th>Gain / Loss</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map(({ ticker, shares, invested }) => {
                    const price = prices[ticker]
                    const value = price != null ? shares * price : null
                    const gain = (value != null && invested > 0) ? value - invested : null
                    const gainPct = (gain != null && invested > 0) ? ((gain / invested) * 100).toFixed(1) : null
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
                        <td className="stock-num">
                          {invested > 0 ? `$${fmt(invested)}` : '—'}
                        </td>
                        <td className="stock-num">
                          {gain != null ? (
                            <span className={gain >= 0 ? 'gain-positive' : 'gain-negative'}>
                              {gain >= 0 ? '+' : '-'}${fmt(Math.abs(gain))} ({gain >= 0 ? '+' : '-'}{Math.abs(gainPct)}%)
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          <div className="etf-holding-actions visible">
                            <button className="icon-btn" title="Edit" onClick={() => prefill(ticker, shares, invested)}>✏️</button>
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
                      <td className="stock-num"><strong>{totalInvested > 0 ? `$${fmt(totalInvested)}` : '—'}</strong></td>
                      <td className="stock-num">
                        {totalInvested > 0 ? (
                          <strong className={totalGain >= 0 ? 'gain-positive' : 'gain-negative'}>
                            {totalGain >= 0 ? '+' : '-'}${fmt(Math.abs(totalGain))} ({totalGain >= 0 ? '+' : '-'}{Math.abs(((totalGain / totalInvested) * 100).toFixed(1))}%)
                          </strong>
                        ) : '—'}
                      </td>
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
