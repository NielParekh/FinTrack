import { useState, useEffect } from 'react'
import { getInvestments, getHysaTransactions, addHysaTransaction, deleteHysaTransaction } from '../lib/api'
import { fmt, today } from '../lib/utils'

export default function HYSA() {
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [type, setType] = useState('deposit')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')

  async function load() {
    const [inv, txs] = await Promise.all([getInvestments(), getHysaTransactions()])
    setBalance(inv.hysa_balance)
    setTransactions(txs)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!amount) return
    await addHysaTransaction({ amount: parseFloat(amount), type, date, note })
    setAmount('')
    setNote('')
    setDate(today())
    load()
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this transaction and reverse its effect on the balance?')) return
    await deleteHysaTransaction(id)
    load()
  }

  const totalDeposited = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
  const totalWithdrawn = transactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0)

  return (
    <>
      <div className="summary-grid three-col mb-24">
        <div className="stat-card">
          <div className="stat-label">Current Balance</div>
          <div className="stat-value">${fmt(balance)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Deposited</div>
          <div className="stat-value income">${fmt(totalDeposited)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Withdrawn</div>
          <div className="stat-value expense">${fmt(totalWithdrawn)}</div>
        </div>
      </div>

      <div className="form-table-layout narrow-form">
        <div className="card">
          <div className="card-header"><h2>Add Transaction</h2></div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="hysa-type-toggle">
                <button
                  type="button"
                  className={`hysa-type-btn${type === 'deposit' ? ' active deposit' : ''}`}
                  onClick={() => setType('deposit')}
                >
                  + Deposit
                </button>
                <button
                  type="button"
                  className={`hysa-type-btn${type === 'withdrawal' ? ' active withdrawal' : ''}`}
                  onClick={() => setType('withdrawal')}
                >
                  − Withdraw
                </button>
              </div>

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

              <button type="submit" className={`btn btn-primary full-width hysa-submit-btn${type === 'withdrawal' ? ' withdrawal' : ''}`}>
                {type === 'deposit' ? '+ Add Deposit' : '\u2212 Record Withdrawal'}
              </button>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2>Transaction History</h2></div>
          <div className="card-body">
            {transactions.length === 0 ? (
              <p className="etf-empty">No transactions yet. Add a deposit or withdrawal to get started.</p>
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
                      <td>
                        <span className={`hysa-badge ${tx.type}`}>
                          {tx.type === 'deposit' ? '+ Deposit' : '\u2212 Withdrawal'}
                        </span>
                      </td>
                      <td className={`stock-num ${tx.type === 'deposit' ? 'hysa-pos' : 'hysa-neg'}`}>
                        {tx.type === 'deposit' ? '+' : '\u2212'}${fmt(tx.amount)}
                      </td>
                      <td className="muted-cell">{tx.note || '\u2014'}</td>
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
