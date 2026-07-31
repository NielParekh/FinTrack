import { useState, useEffect, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import {
  createLinkToken, exchangePublicToken, getSpendingAccounts,
  removeSpendingAccount, syncTransactions,
} from '../lib/api'

export default function SpendingAccounts() {
  const [accounts, setAccounts] = useState([])
  const [linkToken, setLinkToken] = useState(null)
  const [busy, setBusy] = useState(false)
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

  const onSuccess = useCallback(async (publicToken, metadata) => {
    setLinkToken(null)
    setBusy(true)
    setError('')
    try {
      await exchangePublicToken(publicToken, metadata?.institution?.name)
      await load()
      setSyncMsg('Card linked. Syncing transactions…')
      const res = await syncTransactions()
      setSyncMsg(`Synced ${res.added} transactions.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => setLinkToken(null),
  })

  useEffect(() => {
    if (linkToken && ready) open()
  }, [linkToken, ready, open])

  async function handleLink() {
    setError('')
    setBusy(true)
    try {
      const res = await createLinkToken()
      setLinkToken(res.link_token)
    } catch (err) {
      setError(err.message)
    } finally {
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
