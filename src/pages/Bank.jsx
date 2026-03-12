import { useState, useEffect } from 'react'
import { getInvestments, updateInvestments } from '../lib/api'
import { fmt } from '../lib/utils'

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
      <div className="summary-grid single-col mb-24">
        <div className="stat-card">
          <div className="stat-label">Current Balance</div>
          <div className="stat-value">${fmt(balance)}</div>
        </div>
      </div>

      <div className="form-narrow">
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
              <button type="submit" className="btn btn-primary full-width">Save</button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
