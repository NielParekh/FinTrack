import { useState, useEffect } from 'react'
import { getInvestments, updateInvestments } from '../lib/api'

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Bank() {
  const [balance, setBalance] = useState(0)
  const [input, setInput] = useState('')

  async function load() {
    const data = await getInvestments()
    setBalance(data.bank_balance)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await updateInvestments({ bank_balance: parseFloat(input) || 0 })
    setInput('')
    load()
  }

  return (
    <>
      <div className="summary-grid" style={{ gridTemplateColumns: '1fr', marginBottom: 24, maxWidth: 300 }}>
        <div className="stat-card">
          <div className="stat-label">Current Balance</div>
          <div className="stat-value">${fmt(balance)}</div>
        </div>
      </div>

      <div style={{ maxWidth: 320 }}>
        <div className="card">
          <div className="card-header"><h2>Update Balance</h2></div>
          <div className="card-body">
            <p className="inv-desc">Set your current checking / savings account balance.</p>
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
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Save</button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
