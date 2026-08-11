import { useState } from 'react'
import { exportBackup, inspectBackup, restoreBackup } from '../lib/api'

function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export default function Data() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  // A backup that's been read but not yet applied
  const [pending, setPending] = useState(null)

  async function run(fn) {
    setError('')
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleExport = () => run(async () => {
    setStatus('')
    const res = await exportBackup()
    if (res.cancelled) return
    setStatus(`Saved ${res.files} files (${formatBytes(res.bytes)}) to ${res.path}`)
  })

  const handleChoose = () => run(async () => {
    setStatus('')
    const res = await inspectBackup()
    if (res.cancelled) return
    setPending(res)
  })

  const handleRestore = skipPlaid => run(async () => {
    const res = await restoreBackup({ path: pending.path, skipPlaid })
    setPending(null)
    setStatus(
      `Restored ${res.restored} files.` +
      (res.skipped ? ` Skipped ${res.skipped}.` : '') +
      ' Reopen FinTrack to see the restored data.'
    )
  })

  return (
    <div className="page-grid">
      {error && (
        <div className="card"><div className="card-body error-banner">⚠️ {error}</div></div>
      )}

      {status && (
        <div className="card">
          <div className="card-body">
            <p className="muted-cell" style={{ wordBreak: 'break-all' }}>{status}</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h2>Save a copy</h2></div>
        <div className="card-body">
          <p className="inv-desc">
            Writes all your FinTrack data — investments, spending history, HYSA
            transactions, and linked accounts — into a single file. Keep it
            somewhere other than this Mac, so it survives if the disk doesn’t.
          </p>
          <button className="btn btn-primary" onClick={handleExport} disabled={busy}>
            Save a copy…
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2>Restore from a copy</h2></div>
        <div className="card-body">
          <p className="inv-desc">
            Replaces your current data with the contents of a backup file. Your
            existing data is saved first, so this can be undone.
          </p>

          {!pending ? (
            <button className="btn btn-secondary" onClick={handleChoose} disabled={busy}>
              Choose a backup…
            </button>
          ) : (
            <>
              <div className="restore-summary">
                <div className="restore-row">
                  <span className="muted-cell">Created</span>
                  <span>
                    {pending.created_at
                      ? new Date(pending.created_at).toLocaleString()
                      : 'Unknown'}
                  </span>
                </div>
                <div className="restore-row">
                  <span className="muted-cell">Contains</span>
                  <span>{pending.files.length} files</span>
                </div>
              </div>

              {pending.foreign && pending.has_plaid && (
                <p className="inv-desc" style={{ marginTop: '14px' }}>
                  This backup came from a different Mac. Its saved bank
                  connections are encrypted to that machine and won’t work here —
                  you’d need to re-link them. Everything else restores normally.
                </p>
              )}

              <div className="link-actions">
                <button
                  className="btn btn-danger"
                  onClick={() => handleRestore(false)}
                  disabled={busy}
                >
                  Replace my data
                </button>
                {pending.foreign && pending.has_plaid && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleRestore(true)}
                    disabled={busy}
                  >
                    Restore without bank connections
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={() => setPending(null)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
