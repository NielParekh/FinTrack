import { useState, useEffect } from 'react'
import { getExpenses, getSummary, addExpense, updateExpense, deleteExpense } from '../lib/api'
import { categoryIcons } from '../lib/constants'
import ExpenseModal from '../components/ExpenseModal'

export default function Expenses({ showModal, onModalClose }) {
  const [expenses, setExpenses] = useState([])
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [editingExpense, setEditingExpense] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const [exps, summary] = await Promise.all([getExpenses(), getSummary()])
    setExpenses(exps)
    setTotalExpenses(summary.totalExpenses)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(data) {
    if (editingExpense) {
      await updateExpense(editingExpense.id, data)
    } else {
      await addExpense(data)
    }
    setEditingExpense(null)
    onModalClose()
    load()
  }

  function handleClose() {
    setEditingExpense(null)
    onModalClose()
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this expense?')) return
    await deleteExpense(id)
    load()
  }

  function handleEdit(expense) {
    setEditingExpense(expense)
    // modal opened via showModal prop — but we need to signal parent
    // Instead, we manage modal open state locally when editing
  }

  const isModalOpen = showModal || editingExpense !== null

  return (
    <>
      <div className="summary-grid">
        <div className="stat-card">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value expense">${totalExpenses.toFixed(2)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Expenses</h2>
        </div>
        {loading ? (
          <div className="loading">Loading…</div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💳</div>
            <h3>No expenses yet</h3>
            <p>Add your first expense using the button above.</p>
          </div>
        ) : (
          <ul className="transaction-list">
            {expenses.map(exp => (
              <li key={exp.id} className="transaction-item">
                <div className="transaction-icon">
                  {categoryIcons[exp.category] || '📦'}
                </div>
                <div className="transaction-info">
                  <div className="transaction-description">{exp.category}</div>
                  <div className="transaction-meta">
                    <span>{exp.date}</span>
                    <span className="transaction-category">{exp.category}</span>
                  </div>
                </div>
                <div className="transaction-amount amount-expense">
                  -${exp.amount.toFixed(2)}
                </div>
                <div className="transaction-actions">
                  <button
                    className="icon-btn"
                    title="Edit"
                    onClick={() => handleEdit(exp)}
                  >✏️</button>
                  <button
                    className="icon-btn danger"
                    title="Delete"
                    onClick={() => handleDelete(exp.id)}
                  >🗑️</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ExpenseModal
        isOpen={isModalOpen}
        editingExpense={editingExpense}
        onClose={handleClose}
        onSave={handleSave}
      />
    </>
  )
}
