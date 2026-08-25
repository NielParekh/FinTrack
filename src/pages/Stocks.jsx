import { useState, useEffect } from 'react'
import {
  getInvestments, getHoldings, syncHoldings, fetchStockPrices,
  upsertStock, removeStock, updateStockValue, addStockSale,
} from '../lib/api'
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
  const [holdings, setHoldings] = useState([])
  const [syncedAt, setSyncedAt] = useState(null)
  const [prices, setPrices] = useState({})
  const [realizedGains, setRealizedGains] = useState(0)
  const [pricesLoading, setPricesLoading] = useState(false)
  const [pricesError, setPricesError] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState('')
  const [tickerInput, setTickerInput] = useState('')
  const [sharesInput, setSharesInput] = useState('')
  const [saveLabel, setSaveLabel] = useState('Add Stock')
  const [sellStock, setSellStock] = useState(null)
  const [cash, setCash] = useState(0)

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
    const [data, held] = await Promise.all([getInvestments(), getHoldings()])
    const synced = (held?.holdings || []).filter(h => h.type === 'stock')
    setHoldings(synced)
    setSyncedAt(held?.synced_at || null)

    const positions = data.stocks || []
    setStocks(positions)
    setRealizedGains(data.stock_realized_gains || 0)
    // Comes from the backend so the card and net worth always agree — it
    // already excludes any institution whose cash is counted as the HYSA.
    setCash(data.brokerage_cash || 0)

    // Synced holdings carry their own broker price and value, so the Yahoo
    // lookup is only needed for manually entered positions. The synced total
    // still has to be written back, or net worth keeps comparing the manual
    // cost basis against a stale stock value.
    if (synced.length) {
      await updateStockValue(synced.reduce((sum, h) => sum + (h.value || 0), 0))
    } else {
      await loadPrices(positions)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSync() {
    setSyncing(true)
    setSyncStatus('Syncing…')
    setPricesError(null)
    try {
      const res = await syncHoldings()
      await load()
      setSyncStatus(`Synced ${res.holdings} holdings.`)
      if (res.errors?.length) setPricesError(res.errors.join(' · '))
    } catch (err) {
      setPricesError(err.message)
      setSyncStatus('')
    } finally {
      setSyncing(false)
    }
  }

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

  // Synced brokerage holdings win once they exist; manual entries are the
  // fallback until a brokerage is linked.
  const isSynced = holdings.length > 0

  const rows = isSynced
    ? holdings.map(h => {
        const value = h.value ?? 0
        // Plaid marks cost_basis optional, and a zero basis would divide out
        // to a meaningless percentage — both cases show as no gain.
        const hasBasis = h.cost_basis != null && h.cost_basis > 0
        const gain = hasBasis ? value - h.cost_basis : null
        return {
          key: h.ticker + h.institution,
          ticker: h.ticker,
          name: h.name,
          shares: h.shares,
          value,
          gain,
          gainPct: hasBasis ? (gain / h.cost_basis) * 100 : null,
          institution: h.institution,
        }
      })
    : stocks.map(({ ticker, shares }) => {
        const price = prices[ticker]
        return {
          key: ticker,
          ticker,
          shares,
          price,
          value: price != null ? shares * price : null,
          gain: null,
          gainPct: null,
        }
      })

  const totalValue = rows.reduce((sum, r) => sum + (r.value || 0), 0)

  // Per-row profit/loss is display-only: it runs off the cost basis the broker
  // reports, which for Robinhood is incomplete. Portfolio-level gain — the one
  // that feeds net worth on the Dashboard and Investments pages — deliberately
  // ignores it and uses the manually entered stock_cost_basis instead, so a
  // wrong broker basis can never move net worth.
  const noBasis = isSynced ? holdings.filter(h => h.cost_basis == null || h.cost_basis <= 0).length : 0

  return (
    <>
      {sellStock && (
        <SellModal
          ticker={sellStock.ticker}
          onConfirm={handleSellConfirm}
          onClose={() => setSellStock(null)}
        />
      )}

      {/* Cash only appears once a brokerage actually reports some — with no
          linked brokerage the layout stays the original two columns. */}
      <div className={`summary-grid ${cash > 0 ? 'three-col' : 'two-col'} mb-24`}>
        <div className="stat-card">
          <div className="stat-label">Total Stock Value</div>
          <div className="stat-value">{pricesLoading ? '...' : `$${fmt(totalValue)}`}</div>
        </div>
        {cash > 0 && (
          <div className="stat-card">
            <div className="stat-label">Cash</div>
            <div className="stat-value">${fmt(cash)}</div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-label">Realized Gains</div>
          <div className="stat-value" style={{ color: realizedGains >= 0 ? 'var(--income)' : 'var(--expense)' }}>
            {realizedGains >= 0 ? '+' : ''}{`$${fmt(Math.abs(realizedGains))}`}
          </div>
        </div>
      </div>

      <div className={isSynced ? '' : 'form-table-layout'}>
        {!isSynced && (
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
        )}

        <div className="card">
          <div className="card-header">
            <h2>Holdings</h2>
            {isSynced ? (
              syncedAt && (
                <span className="muted-cell">Synced {new Date(syncedAt).toLocaleString()}</span>
              )
            ) : (
              <button
                className="icon-btn refresh-btn"
                title="Refresh prices"
                disabled={pricesLoading || stocks.length === 0}
                onClick={() => loadPrices(stocks)}
              >
                {pricesLoading ? '⏳' : '↻'}
              </button>
            )}
          </div>
          <div className="card-body">
            {pricesError && <p className="error-text">{pricesError}</p>}
            {rows.length === 0 ? (
              <p className="etf-empty">
                No stocks yet. Link your brokerage from the ETFs tab to pull holdings automatically, or add one manually.
              </p>
            ) : (
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Shares</th>
                    {isSynced && <th>Market Value</th>}
                    {!isSynced && <th>Live Price</th>}
                    {!isSynced && <th>Value</th>}
                    {isSynced && <th>Profit / Loss</th>}
                    {isSynced && <th>P/L %</th>}
                    {isSynced && <th>Account</th>}
                    {!isSynced && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.key}>
                      <td>
                        <span className="etf-ticker-badge">{r.ticker}</span>
                      </td>
                      <td className="stock-num">
                        {r.shares?.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </td>
                      {isSynced && (
                        <td className="stock-num stock-value-cell">${fmt(r.value)}</td>
                      )}
                      {!isSynced && (
                        <td className="stock-num">
                          {r.price != null ? `$${fmt(r.price)}` : pricesLoading ? '...' : 'N/A'}
                        </td>
                      )}
                      {!isSynced && (
                        <td className="stock-num stock-value-cell">
                          {r.value != null ? `$${fmt(r.value)}` : '—'}
                        </td>
                      )}
                      {isSynced && (
                        <td className="stock-num">
                          {r.gain === null ? '—' : (
                            <span className={r.gain >= 0 ? 'gain-positive' : 'gain-negative'}>
                              {r.gain >= 0 ? '+' : '−'}${fmt(Math.abs(r.gain))}
                            </span>
                          )}
                        </td>
                      )}
                      {isSynced && (
                        <td className="stock-num">
                          {r.gainPct === null ? '—' : (
                            <span className={r.gainPct >= 0 ? 'gain-positive' : 'gain-negative'}>
                              {r.gainPct >= 0 ? '+' : '−'}{Math.abs(r.gainPct).toFixed(2)}%
                            </span>
                          )}
                        </td>
                      )}
                      {isSynced && <td className="muted-cell">{r.institution}</td>}
                      {!isSynced && (
                        <td>
                          <div className="etf-holding-actions visible">
                            <button className="icon-btn sell-btn" title="Sell" onClick={() => setSellStock({ ticker: r.ticker, shares: r.shares })}>$</button>
                            <button className="icon-btn" title="Edit" onClick={() => prefill(r.ticker, r.shares)}>✏️</button>
                            <button className="icon-btn danger" title="Remove" onClick={() => handleRemove(r.ticker)}>🗑️</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!isSynced && rows.length > 1 && (
                    <tr className="stock-total-row">
                      <td colSpan={3}><strong>Total</strong></td>
                      <td className="stock-num stock-value-cell"><strong>${fmt(totalValue)}</strong></td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {noBasis > 0 && (
              <p className="muted-cell sync-status">
                {noBasis} of {holdings.length} positions report no cost basis from your brokerage — their profit/loss shows as &mdash;.
              </p>
            )}

            {isSynced && (
              <>
                <p className="muted-cell sync-status">
                  Per-position profit / loss uses the cost basis Robinhood reports, which is missing
                  older history — treat these two columns as a rough guide. Your overall gain on the
                  Dashboard and Investments pages is unaffected: it uses the cost basis you entered
                  manually.
                </p>
                <div className="link-actions">
                  <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
                    ⟳ Sync holdings
                  </button>
                </div>
                {syncStatus && <p className="muted-cell sync-status">{syncStatus}</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
