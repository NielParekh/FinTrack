import { useState, useEffect } from 'react'
import { ALLOWED_CATEGORIES } from '../lib/constants'
import { today } from '../lib/utils'

export default function ExpenseModal({ isOpen, editingExpense, onClose, onSave }) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [category, setCategory] = useState(ALLOWED_CATEGORIES[0])

  useEffect(() => {
    if (isOpen) {
      if (editingExpense) {
        setAmount(String(editingExpense.amount))
        setDate(editingExpense.date)
        setCategory(editingExpense.category)
      } else {
        setAmount('')
        setDate(today())
        setCategory(ALLOWED_CATEGORIES[0])
      }
    }
  }, [isOpen, editingExpense])

  if (!isOpen) return null

  function handleSubmit(e) {
    e.preventDefault()
    onSave({ amount: parseFloat(amount), date, category })
  }

  return (
    <div className="modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>{editingExpense ? 'Edit Expense' : 'Add Expense'}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="input-group">
                <label>Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="input-group">
                <label>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="input-group">
              <label>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {ALLOWED_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                {editingExpense ? 'Save changes' : 'Add expense'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
