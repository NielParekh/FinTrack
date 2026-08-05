import { useState, useEffect } from 'react'
import {
  getInvestments, getHoldings, getBrokerageAccounts,
  linkBrokerageHosted, syncHoldings, removeBrokerage, cancelHostedLink,
} from '../lib/api'
import { fmt } from '../lib/utils'

export default function ETFs() {
  const [manualEtfs, setManualEtfs] = useState([])
  const [etfCostBasis, setEtfCostBasis] = useState(0)
  const [holdings, setHoldings] = useState([])
  const [syncedAt, setSyncedAt] = useState(null)
  const [brokerages, setBrokerages] = useState([])
  const [busy, setBusy] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  async function load() {
    try {
      const [inv, held, accts] = await Promise.all([
        getInvestments(), getHoldings(), getBrokerageAccounts(),
      ])
      setManualEtfs(inv.etfs || [])
      setEtfCostBasis(inv.etf_cost_basis || 0)
      setHoldings((held?.holdings || []).filter(h => h.type === 'etf'))
      setSyncedAt(held?.synced_at || null)
      setBrokerages(accts)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { load() }, [])

  async function handleLink() {
    setError('')
    setBusy(true)
    setLinking(true)
    setStatus('Finish linking in your browser — this page updates when you’re done.')
    try {
      const res = await linkBrokerageHosted()
      setLinking(false)
      if (res.cancelled) {
        setStatus(res.timeout ? 'Linking timed out. Try again.' : '')
      } else {
        setStatus('Linked. Pulling holdings…')
        const sync = await syncHoldings()
        await load()
        setStatus(`Synced ${sync.holdings} holdings.`)
        if (sync.errors?.length) setError(sync.errors.join(' · '))
      }
    } catch (err) {
      setError(err.message)
      setStatus('')
    } finally {
      setLinking(false)
      setBusy(false)
    }
  }

  async function handleSync() {
    setError('')
    setBusy(true)
    setStatus('Syncing…')
    try {
      const sync = await syncHoldings()
      await load()
      setStatus(`Synced ${sync.holdings} holdings.`)
      if (sync.errors?.length) setError(sync.errors.join(' · '))
    } catch (err) {
      setError(err.message)
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  function handleCancelLink() {
    cancelHostedLink()
    setStatus('')
  }

  async function handleRemoveBrokerage(itemId, institution) {
    if (!window.confirm(`Unlink ${institution}? Its holdings will be removed from FinTrack.`)) return
    setError('')
    setBusy(true)
    try {
      await removeBrokerage(itemId)
      await load()
      setStatus(`${institution} unlinked.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Synced holdings win once they exist; manual entries are the fallback
  const isSynced = holdings.length > 0
  const rows = isSynced
    ? holdings.map(h => {
        const value = h.value ?? 0
        // Plaid marks cost_basis optional — without it there's no gain to show
        const gain = h.cost_basis != null ? value - h.cost_basis : null
        return {
          ticker: h.ticker,
          name: h.name,
          shares: h.shares,
          value,
          costBasis: h.cost_basis,
          gain,
          gainPct: gain !== null && h.cost_basis > 0 ? (gain / h.cost_basis) * 100 : null,
          institution: h.institution,
        }
      })
    : manualEtfs.map(e => ({ ticker: e.ticker, value: e.value }))

  const total = rows.reduce((s, r) => s + (r.value || 0), 0)

  // Only positions reporting a cost basis can contribute to profit/loss —
  // summing every value against a partial basis would overstate the gain.
  const priced = isSynced ? holdings.filter(h => h.cost_basis != null) : []
  const syncedCostBasis = priced.reduce((s, h) => s + h.cost_basis, 0)
  const pricedValue = priced.reduce((s, h) => s + (h.value ?? 0), 0)
  const partialBasis = isSynced && priced.length !== holdings.length

  const useSynced = isSynced && syncedCostBasis > 0
  const basis = useSynced ? syncedCostBasis : etfCostBasis
  const gain = basis > 0 ? (useSynced ? pricedValue : total) - basis : null

  return (
    <>
      <div className="summary-grid three-col mb-24">
        <div className="stat-card">
          <div className="stat-label">Total ETF Value</div>
          <div className="stat-value">${fmt(total)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Profit / Loss</div>
          {gain !== null ? (
            <div className={`stat-value ${gain >= 0 ? 'gain-positive' : 'gain-negative'}`}>
              {gain >= 0 ? '+' : ''}${fmt(Math.abs(gain))} ({gain >= 0 ? '+' : '-'}{Math.abs(((gain / basis) * 100)).toFixed(1)}%)
            </div>
          ) : (
            <div className="stat-value">&mdash;</div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">Positions</div>
          <div className="stat-value">{rows.length}</div>
        </div>
      </div>

      {error && <div className="card mb-24"><div className="card-body error-banner">⚠️ {error}</div></div>}

      <div className="card">
        <div className="card-header">
          <h2>Holdings</h2>
          {syncedAt && (
            <span className="muted-cell">
              Synced {new Date(syncedAt).toLocaleString()}
            </span>
          )}
        </div>
        <div className="card-body">
          {rows.length === 0 ? (
            <p className="etf-empty">
              No ETFs yet. Link your brokerage to pull holdings automatically.
            </p>
          ) : (
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  {isSynced && <th>Shares</th>}
                  {isSynced && <th>Cost Basis</th>}
                  <th>Value</th>
                  {isSynced && <th>Profit / Loss</th>}
                  {isSynced && <th>Account</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.ticker + (r.institution || '')}>
                    <td><span className="etf-ticker-badge">{r.ticker}</span></td>
                    {isSynced && <td className="stock-num">{r.shares?.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>}
                    {isSynced && <td className="stock-num">{r.costBasis != null ? `$${fmt(r.costBasis)}` : '—'}</td>}
                    <td className="stock-num stock-value-cell">${fmt(r.value)}</td>
                    {isSynced && (
                      <td className="stock-num">
                        {r.gain === null ? '—' : (
                          <span className={r.gain >= 0 ? 'gain-positive' : 'gain-negative'}>
                            {r.gain >= 0 ? '+' : '−'}${fmt(Math.abs(r.gain))}
                            {r.gainPct !== null && ` (${r.gain >= 0 ? '+' : '−'}${Math.abs(r.gainPct).toFixed(1)}%)`}
                          </span>
                        )}
                      </td>
                    )}
                    {isSynced && <td className="muted-cell">{r.institution}</td>}
                  </tr>
                ))}
                {rows.length > 1 && (
                  <tr className="stock-total-row">
                    <td><strong>Total</strong></td>
                    {isSynced && <td></td>}
                    {isSynced && <td className="stock-num"><strong>${fmt(syncedCostBasis)}</strong></td>}
                    <td className="stock-num stock-value-cell"><strong>${fmt(total)}</strong></td>
                    {isSynced && (
                      <td className="stock-num">
                        {gain === null ? '—' : (
                          <strong className={gain >= 0 ? 'gain-positive' : 'gain-negative'}>
                            {gain >= 0 ? '+' : '−'}${fmt(Math.abs(gain))}
                          </strong>
                        )}
                      </td>
                    )}
                    {isSynced && <td></td>}
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {partialBasis && (
            <p className="muted-cell sync-status">
              {holdings.length - priced.length} of {holdings.length} positions have no cost basis from your brokerage — profit/loss covers the rest.
            </p>
          )}

          {!isSynced && manualEtfs.length > 0 && (
            <p className="muted-cell sync-status">
              These are your manually entered values. Link your brokerage to replace them with live holdings.
            </p>
          )}

          <div className="link-actions">
            {brokerages.length === 0 ? (
              <button className="btn btn-primary" onClick={handleLink} disabled={busy}>
                + Link brokerage
              </button>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={handleSync} disabled={busy}>
                  ⟳ Sync holdings
                </button>
                <button className="btn btn-secondary" onClick={handleLink} disabled={busy}>
                  + Link another
                </button>
              </>
            )}
            {linking && (
              <button className="btn btn-secondary" onClick={handleCancelLink}>Cancel linking</button>
            )}
          </div>
          {status && <p className="muted-cell sync-status">{status}</p>}

          {brokerages.length > 0 && (
            <div className="muted-cell sync-status">
              {brokerages.map(b => (
                <span key={b.item_id} className="brokerage-chip">
                  {b.institution}
                  {b.status !== 'ok' && ' (needs re-link)'}
                  <button
                    className="icon-btn danger"
                    title={`Unlink ${b.institution}`}
                    disabled={busy}
                    onClick={() => handleRemoveBrokerage(b.item_id, b.institution)}
                  >🗑️</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
