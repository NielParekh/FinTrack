import { useState, useEffect } from 'react'
import {
  linkCardHosted, relinkCardHosted, cancelHostedLink, getSpendingAccounts,
  removeSpendingAccount, syncTransactions,
} from '../lib/api'

export default function SpendingAccounts() {
  const [accounts, setAccounts] = useState([])
  const [busy, setBusy] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState('')
  const [syncMsg, setSyncMsg] = useState('')

  async function load() {
    try {
      setAccounts(await getSpendingAccounts())
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => { load() }, [])

  async function handleLink() {
    setError('')
    setBusy(true)
    setLinking(true)
    setSyncMsg('Finish linking in your browser — this page updates automatically when you’re done.')
    try {
      const res = await linkCardHosted()
      setLinking(false)
      if (res.cancelled) {
        setSyncMsg(res.timeout ? 'Linking timed out. Click "+ Link a card" to try again.' : '')
      } else {
        await load()
        setSyncMsg('Card linked. Syncing transactions…')
        const sync = await syncTransactions()
        setSyncMsg(`Synced ${sync.added} transactions.`)
      }
    } catch (err) {
      setError(err.message)
      setSyncMsg('')
    } finally {
      setLinking(false)
      setBusy(false)
    }
  }

  function handleCancelLink() {
    cancelHostedLink()
    setSyncMsg('')
  }

  async function handleRelink(itemId, institution) {
    setError('')
    setBusy(true)
    setLinking(true)
    setSyncMsg(`Re-authenticate ${institution} in your browser — transactions and history are kept.`)
    try {
      const res = await relinkCardHosted(itemId)
      setLinking(false)
      if (res.cancelled) {
        setSyncMsg(res.timeout ? 'Re-linking timed out. Try again.' : '')
      } else {
        await load()
        setSyncMsg(`${institution} reconnected. Syncing…`)
        const sync = await syncTransactions()
        setSyncMsg(`${institution} reconnected. Synced ${sync.added} new transactions.`)
        await load()
      }
    } catch (err) {
      setError(err.message)
      setSyncMsg('')
    } finally {
      setLinking(false)
      setBusy(false)
    }
  }

  async function handleSync() {
    setError('')
    setSyncMsg('Syncing…')
    setBusy(true)
    try {
      const res = await syncTransactions()
      const parts = [`${res.added} new`, `${res.modified} updated`]
      if (res.removed) parts.push(`${res.removed} removed`)
      setSyncMsg(`Sync complete: ${parts.join(', ')}.`)
      if (res.errors?.length) setError(res.errors.join(' · '))
      await load()
    } catch (err) {
      setError(err.message)
      setSyncMsg('')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(itemId, institution) {
    if (!confirm(`Unlink ${institution}? Its transactions will be removed from FinTrack.`)) return
    setError('')
    try {
      await removeSpendingAccount(itemId)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page-grid">
      {error && <div className="card"><div className="card-body error-banner">⚠️ {error}</div></div>}

      <div className="card">
        <div className="card-header"><h2>Linked Cards</h2></div>
        <div className="card-body">
          {accounts.length === 0 ? (
            <p className="etf-empty">No cards linked yet. Link your credit card to start pulling transactions automatically.</p>
          ) : (
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Accounts</th>
                  <th>Status</th>
                  <th>Last synced</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(item => (
                  <tr key={item.item_id}>
                    <td>{item.institution}</td>
                    <td className="muted-cell">
                      {item.accounts.map(a => `${a.name} ••${a.mask ?? ''}`).join(', ')}
                    </td>
                    <td>
                      {item.status === 'ok'
                        ? <span className="hysa-pos">Connected</span>
                        : <span className="expense">Needs re-link</span>}
                    </td>
                    <td className="muted-cell">
                      {item.last_synced ? new Date(item.last_synced).toLocaleString() : '—'}
                    </td>
                    <td>
                      <div className="etf-holding-actions visible">
                        {item.status !== 'ok' && (
                          <button
                            className="btn btn-secondary btn-relink"
                            disabled={busy}
                            onClick={() => handleRelink(item.item_id, item.institution)}
                          >
                            Re-link
                          </button>
                        )}
                        <button className="icon-btn danger" title="Unlink" onClick={() => handleRemove(item.item_id, item.institution)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="link-actions">
            <button className="btn btn-primary" onClick={handleLink} disabled={busy}>
              + Link a card
            </button>
            {linking && (
              <button className="btn btn-secondary" onClick={handleCancelLink}>
                Cancel linking
              </button>
            )}
            {accounts.length > 0 && (
              <button className="btn btn-secondary" onClick={handleSync} disabled={busy}>
                ⟳ Sync now
              </button>
            )}
          </div>
          {syncMsg && <p className="muted-cell sync-status">{syncMsg}</p>}
        </div>
      </div>
    </div>
  )
}
