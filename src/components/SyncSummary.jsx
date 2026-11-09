import { useState, useEffect } from 'react'
import { syncEverything } from '../lib/launchSync'
import { fmt } from '../lib/utils'

// StrictMode mounts effects twice in dev; the launch sync must run once
let launched = false

const MAX_ROWS = 12

function Money({ amount }) {
  // Plaid convention: positive = money out, negative = money back
  return amount > 0
    ? <span className="expense">${fmt(amount)}</span>
    : <span className="gain-pos">+${fmt(Math.abs(amount))}</span>
}

function Delta({ before, after }) {
  const d = after - before
  if (Math.abs(d) < 0.01) return <span className="muted-cell">unchanged</span>
  return (
    <span className={d > 0 ? 'gain-pos' : 'gain-neg'}>
      {d > 0 ? '+' : '−'}${fmt(Math.abs(d))}
    </span>
  )
}

function TxList({ txs, cardNames }) {
  const shown = txs.slice(0, MAX_ROWS)
  return (
    <>
      <table className="stock-table sync-table">
        <tbody>
          {shown.map(t => (
            <tr key={t.id}>
              <td className="muted-cell">{t.date}</td>
              <td>
                {t.merchant}
                {t.pending && <span className="muted-cell"> · pending</span>}
              </td>
              <td className="muted-cell">{cardNames[t.account_id] || ''}</td>
              <td className="stock-num"><Money amount={t.amount} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {txs.length > shown.length && (
        <p className="muted-cell sync-more">and {txs.length - shown.length} more</p>
      )}
    </>
  )
}

function shareText(n) {
  return `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 4 })} sh`
}

export default function SyncSummary({ onSynced, onViewSpending }) {
  const [phase, setPhase] = useState('idle') // idle | running | quiet | open
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    if (launched) return
    launched = true
    setPhase('running')
    syncEverything()
      .then(s => {
        setSummary(s)
        onSynced()
        setPhase(s.hasChanges || s.errors.length ? 'open' : s.ran ? 'quiet' : 'idle')
      })
      .catch(err => {
        setSummary({ errors: [err.message], added: [], posted: [], removed: [], failed: true })
        setPhase('open')
      })
  }, [])

  useEffect(() => {
    if (phase !== 'quiet') return
    const id = setTimeout(() => setPhase('idle'), 3000)
    return () => clearTimeout(id)
  }, [phase])

  if (phase === 'running') return <div className="sync-pill">⟳ Syncing your accounts…</div>
  if (phase === 'quiet') return <div className="sync-pill">✓ All up to date</div>
  if (phase !== 'open') return null

  const close = () => setPhase('idle')
  const { added, posted, removed, errors, cardNames = {}, holdings, hysa, netWorth } = summary

  return (
    <div className="modal" onClick={close}>
      <div className="modal-content sync-summary" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Since your last sync</h2>
          <button className="close-btn" onClick={close}>✕</button>
        </div>
        <div className="modal-body">
          {netWorth && (
            <div className="sync-row">
              <span>Net worth</span>
              <span>${fmt(netWorth.after)} <Delta before={netWorth.before} after={netWorth.after} /></span>
            </div>
          )}

          {added.length > 0 && (
            <section className="sync-section">
              <h3>{added.length} new transaction{added.length === 1 ? '' : 's'}</h3>
              <TxList txs={added} cardNames={cardNames} />
            </section>
          )}

          {posted.length > 0 && (
            <section className="sync-section">
              <h3>{posted.length} pending charge{posted.length === 1 ? '' : 's'} posted</h3>
              <TxList txs={posted} cardNames={cardNames} />
            </section>
          )}

          {removed.length > 0 && (
            <section className="sync-section">
              <h3>{removed.length} transaction{removed.length === 1 ? '' : 's'} dropped</h3>
              <p className="muted-cell sync-note">Usually a pending hold that never went through.</p>
              <TxList txs={removed} cardNames={cardNames} />
            </section>
          )}

          {holdings && (holdings.changes.length > 0 || Math.abs(holdings.valueAfter - holdings.valueBefore) >= 0.01) && (
            <section className="sync-section">
              <h3>Holdings</h3>
              <div className="sync-row">
                <span>Total value</span>
                <span>${fmt(holdings.valueAfter)} <Delta before={holdings.valueBefore} after={holdings.valueAfter} /></span>
              </div>
              {holdings.changes.map(c => (
                <div className="sync-row" key={`${c.institution}|${c.ticker}|${c.kind}`}>
                  <span>{c.ticker} <span className="muted-cell">· {c.institution}</span></span>
                  <span className="muted-cell">
                    {c.kind === 'new' && `new position, ${shareText(c.shares)}`}
                    {c.kind === 'closed' && `closed (was ${shareText(c.from)})`}
                    {c.kind === 'shares' && `${shareText(c.from)} → ${shareText(c.shares)}`}
                  </span>
                </div>
              ))}
            </section>
          )}

          {hysa && Math.abs(hysa.after - hysa.before) >= 0.01 && (
            <section className="sync-section">
              <h3>HYSA</h3>
              <div className="sync-row">
                <span>Balance</span>
                <span>${fmt(hysa.after)} <Delta before={hysa.before} after={hysa.after} /></span>
              </div>
            </section>
          )}

          {errors.length > 0 && (
            <section className="sync-section">
              <h3>Couldn’t sync</h3>
              {errors.map(e => <p key={e} className="error-banner">⚠️ {e}</p>)}
            </section>
          )}

          <div className="form-actions">
            {(added.length > 0 || posted.length > 0) && (
              <button className="btn" onClick={() => { close(); onViewSpending() }}>View spending</button>
            )}
            <button className="btn btn-primary" onClick={close}>Done</button>
          </div>
        </div>
      </div>
    </div>
  )
}
