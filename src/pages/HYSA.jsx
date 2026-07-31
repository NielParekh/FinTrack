import { useState, useEffect } from 'react'
import { getInvestments, getHysaTransactions, addHysaTransaction, deleteHysaTransaction, updateHysaBalance } from '../lib/api'
import { fmt, today } from '../lib/utils'

export default function HYSA() {
  const [balance, setBalance] = useState(0)
  const [principal, setPrincipal] = useState(0)
  const [transactions, setTransactions] = useState([])

  // deposit form
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')

  // withdraw form
  const [wAmount, setWAmount] = useState('')
  const [wDate, setWDate] = useState(today())
  const [wNote, setWNote] = useState('')

  // current value update
  const [newBalance, setNewBalance] = useState('')

  async function load() {
    const [inv, txs] = await Promise.all([getInvestments(), getHysaTransactions()])
    setBalance(inv.hysa_balance || 0)
    setPrincipal(inv.hysa_cost_basis || 0)
    setTransactions(txs)
  }

  useEffect(() => { load() }, [])

  async function handleDeposit(e) {
    e.preventDefault()
    if (!amount) return
    await addHysaTransaction({ amount: parseFloat(amount), type: 'deposit', date, note })
    setAmount('')
    setNote('')
    setDate(today())
    load()
  }

  async function handleWithdraw(e) {
    e.preventDefault()
    if (!wAmount) return
    await addHysaTransaction({ amount: parseFloat(wAmount), type: 'withdrawal', date: wDate, note: wNote })
    setWAmount('')
    setWNote('')
    setWDate(today())
    load()
  }

  async function handleUpdateBalance(e) {
    e.preventDefault()
    if (newBalance === '') return
    await updateHysaBalance(parseFloat(newBalance))
    setNewBalance('')
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this transaction and reverse its effect on the balance?')) return
    await deleteHysaTransaction(id)
    load()
  }

  const interestEarned = balance - principal
  const interestPct = principal > 0 ? (interestEarned / principal) * 100 : 0

  return (
    <>
      <div className="summary-grid four-col mb-24">
        <div className="stat-card">
          <div className="stat-label">Principal</div>
          <div className="stat-value">${fmt(principal)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Current Value</div>
          <div className="stat-value">${fmt(balance)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Interest Earned</div>
          <div className={`stat-value ${interestEarned >= 0 ? 'income' : 'expense'}`}>
            {interestEarned >= 0 ? '+' : ''}${fmt(interestEarned)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Return</div>
          <div className={`stat-value ${interestPct >= 0 ? 'income' : 'expense'}`}>
            {interestPct >= 0 ? '+' : ''}{interestPct.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="form-table-layout narrow-form">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card">
            <div className="card-header"><h2>Add to Principal</h2></div>
            <div className="card-body">
              <form onSubmit={handleDeposit}>
                <div className="input-group">
                  <label>Amount ($)</label>
                  <input type="number" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label>Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label>Note <span className="label-hint">(optional)</span></label>
                  <input type="text" placeholder="e.g. Monthly transfer" value={note} onChange={e => setNote(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary full-width hysa-submit-btn">
                  + Add to Principal
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2>Withdraw from Principal</h2></div>
            <div className="card-body">
              <form onSubmit={handleWithdraw}>
                <div className="input-group">
                  <label>Amount ($)</label>
                  <input type="number" step="0.01" placeholder="0.00" value={wAmount} onChange={e => setWAmount(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label>Date</label>
                  <input type="date" value={wDate} onChange={e => setWDate(e.target.value)} required />
                </div>
                <div className="input-group">
                  <label>Note <span className="label-hint">(optional)</span></label>
                  <input type="text" placeholder="e.g. Transfer to checking" value={wNote} onChange={e => setWNote(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-danger full-width">
                  &minus; Withdraw from Principal
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2>Update Current Value</h2></div>
            <div className="card-body">
              <form onSubmit={handleUpdateBalance}>
                <div className="input-group">
                  <label>Total Account Value ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={fmt(balance)}
                    value={newBalance}
                    onChange={e => setNewBalance(e.target.value)}
                    required
                  />
                  <div className="label-hint" style={{ marginTop: '4px' }}>
                    Set this to the current balance shown in your bank account (principal + interest).
                  </div>
                </div>
                <button type="submit" className="btn btn-primary full-width">
                  Update Value
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2>Principal History</h2></div>
          <div className="card-body">
            {transactions.length === 0 ? (
              <p className="etf-empty">No transactions yet.</p>
            ) : (
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Note</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id}>
                      <td className="muted-cell">{tx.date}</td>
                      <td className="muted-cell" style={{ textTransform: 'capitalize' }}>{tx.type}</td>
                      <td className={`stock-num ${tx.type === 'withdrawal' ? 'expense' : 'hysa-pos'}`}>
                        {tx.type === 'withdrawal' ? '-' : '+'}${fmt(tx.amount)}
                      </td>
                      <td className="muted-cell">{tx.note || '—'}</td>
                      <td>
                        <div className="etf-holding-actions visible">
                          <button className="icon-btn danger" title="Delete" onClick={() => handleDelete(tx.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
