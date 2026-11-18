import { useState, useEffect } from 'react'
import {
  getInvestments, updateInvestments, linkBankHosted, getBankAccounts,
  syncBankBalance, removeBank, relinkCardHosted, cancelHostedLink,
} from '../lib/api'
import { fmt } from '../lib/utils'

export default function Bank() {
  const [balance, setBalance] = useState(0)
  const [banks, setBanks] = useState([])
  const [syncedAt, setSyncedAt] = useState(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [linking, setLinking] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const [inv, linked] = await Promise.all([getInvestments(), getBankAccounts()])
    setBalance(inv.bank_balance)
    setBanks(linked.items)
    setSyncedAt(linked.synced_at)
  }

  useEffect(() => { load().catch(err => setError(err.message)) }, [])

  async function run(fn) {
    setError('')
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
      setStatus('')
    } finally {
      setLinking(false)
      setBusy(false)
    }
  }

  async function sync() {
    const res = await syncBankBalance()
    await load()
    if (res.errors?.length) {
      setError(res.errors.join(' · '))
      setStatus('Kept the last balance until every linked bank syncs.')
      return
    }
    const delta = res.bank_balance - res.previous
    setStatus(
      Math.abs(delta) < 0.01
        ? `Balance unchanged — $${fmt(res.bank_balance)}.`
        : `Updated to $${fmt(res.bank_balance)} (${delta > 0 ? '+' : '−'}$${fmt(Math.abs(delta))}).`
    )
  }

  const handleLink = () => run(async () => {
    if (banks.length && !confirm('Link another bank? Each bank you link uses one of your Plaid connections.')) return
    setLinking(true)
    setStatus('Finish linking in your browser — this page updates automatically when you’re done.')
    const res = await linkBankHosted()
    setLinking(false)
    if (res.cancelled) {
      setStatus(res.timeout ? 'Linking timed out. Try again.' : '')
      return
    }
    setStatus('Bank linked. Fetching balance…')
    await sync()
  })

  // Update mode on the existing connection: fixes a login that expired, or
  // changes which accounts are shared, without using a new Plaid connection
  const handleRelink = (itemId, institution) => run(async () => {
    setLinking(true)
    setStatus(`Sign in to ${institution} in your browser and choose which accounts to share.`)
    const res = await relinkCardHosted(itemId)
    setLinking(false)
    if (res.cancelled) {
      setStatus(res.timeout ? 'Re-linking timed out. Try again.' : '')
      return
    }
    setStatus(`${institution} updated. Fetching balance…`)
    await sync()
  })

  const handleSync = () => run(async () => {
    setStatus('Syncing…')
    await sync()
  })

  const handleRemove = (itemId, institution) => run(async () => {
    if (!confirm(
      `Unlink ${institution}? The balance stops updating and becomes editable by hand. ` +
      'Linking it again later uses a new Plaid connection — to fix a broken login, use Re-link instead.'
    )) return
    await removeBank(itemId)
    setStatus(`${institution} unlinked.`)
    await load()
  })

  function handleCancelLink() {
    cancelHostedLink()
    setStatus('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await updateInvestments({ bank_balance: parseFloat(input) || 0 })
    setInput('')
    load()
  }

  const linked = banks.length > 0

  return (
    <>
      <div className="summary-grid single-col mb-24">
        <div className="stat-card">
          <div className="stat-label">Current Balance</div>
          <div className="stat-value">${fmt(balance)}</div>
          {linked && syncedAt && (
            <div className="muted-cell mt-6">Synced {new Date(syncedAt).toLocaleString()}</div>
          )}
        </div>
      </div>

      <div className="page-grid">
        {error && <div className="card"><div className="card-body error-banner">⚠️ {error}</div></div>}

        <div className="card">
          <div className="card-header"><h2>{linked ? 'Linked bank' : 'Link your bank'}</h2></div>
          <div className="card-body">
            {!linked ? (
              <p className="inv-desc">
                Connect your checking or savings account and the balance updates
                on its own each time FinTrack opens. Bank transactions stay out
                of Spending.
              </p>
            ) : (
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {banks.flatMap(item => (item.accounts || []).map((a, i) => (
                    <tr key={a.id}>
                      <td>
                        {item.institution} · {a.name}
                        {a.mask && <span className="muted-cell"> ••{a.mask}</span>}
                      </td>
                      <td className="stock-num stock-value-cell">
                        {a.balance != null ? `$${fmt(a.balance)}` : '—'}
                      </td>
                      <td>
                        {item.status === 'ok'
                          ? <span className="hysa-pos">Connected</span>
                          : <span className="expense">Needs re-link</span>}
                      </td>
                      <td>
                        {/* Actions are per connection, so show them once */}
                        {i === 0 && (
                          <div className="etf-holding-actions visible">
                            <button
                              className="btn btn-secondary btn-relink"
                              disabled={busy}
                              onClick={() => handleRelink(item.item_id, item.institution)}
                            >
                              {item.status === 'ok' ? 'Manage accounts' : 'Re-link'}
                            </button>
                            <button
                              className="icon-btn danger"
                              title={`Unlink ${item.institution}`}
                              disabled={busy}
                              onClick={() => handleRemove(item.item_id, item.institution)}
                            >🗑️</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            )}

            <div className="link-actions">
              {linked && (
                <button className="btn btn-primary" onClick={handleSync} disabled={busy}>
                  ⟳ Sync now
                </button>
              )}
              <button
                className={`btn ${linked ? 'btn-secondary' : 'btn-primary'}`}
                onClick={handleLink}
                disabled={busy}
              >
                {linked ? '+ Link another bank' : '+ Link bank account'}
              </button>
              {linking && (
                <button className="btn btn-secondary" onClick={handleCancelLink}>Cancel linking</button>
              )}
            </div>
            {status && <p className="muted-cell sync-status">{status}</p>}
          </div>
        </div>

        {/* A synced balance would overwrite a typed one on the next launch */}
        {!linked && (
          <div className="form-narrow">
            <div className="card">
              <div className="card-header"><h2>Update Balance</h2></div>
              <div className="card-body">
                <p className="inv-desc">Or set your checking / savings balance by hand.</p>
                <form onSubmit={handleSubmit}>
                  <div className="input-group">
                    <label>Balance ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={fmt(balance)}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary full-width">Save</button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
