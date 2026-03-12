const { ipcMain } = require('electron')
const { readJSON, writeJSON, getNextId } = require('../lib/data')

const ALLOWED_CATEGORIES = new Set(['Food', 'Rent', 'Travel', 'Misc'])

function validateExpense({ amount, category, date }) {
  if (!amount || !date) throw new Error('Missing required fields')
  if (parseFloat(amount) <= 0) throw new Error('Amount must be greater than 0')
  if (!category) throw new Error('Category is required')
  if (!ALLOWED_CATEGORIES.has(category)) {
    throw new Error(`Category must be one of ${[...ALLOWED_CATEGORIES].sort().join(', ')}`)
  }
}

function register() {
  ipcMain.handle('get-expenses', () => {
    return readJSON('transactions.json')
      .filter(t => t.type === 'expense')
      .sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date)
        return (b.created_at || '').localeCompare(a.created_at || '')
      })
  })

  ipcMain.handle('add-expense', (_, data) => {
    validateExpense(data)
    const transactions = readJSON('transactions.json')
    const newTx = {
      id: getNextId(transactions),
      type: 'expense',
      amount: parseFloat(data.amount),
      category: data.category,
      date: data.date,
      created_at: new Date().toISOString(),
    }
    transactions.push(newTx)
    writeJSON('transactions.json', transactions)
    return newTx
  })

  ipcMain.handle('update-expense', (_, id, data) => {
    validateExpense(data)
    const transactions = readJSON('transactions.json')
    const idx = transactions.findIndex(t => t.id === id)
    if (idx === -1) throw new Error('Transaction not found')
    transactions[idx] = { ...transactions[idx], amount: parseFloat(data.amount), category: data.category, date: data.date }
    writeJSON('transactions.json', transactions)
    return transactions[idx]
  })

  ipcMain.handle('delete-expense', (_, id) => {
    const transactions = readJSON('transactions.json')
    const idx = transactions.findIndex(t => t.id === id)
    if (idx === -1) throw new Error('Transaction not found')
    transactions.splice(idx, 1)
    writeJSON('transactions.json', transactions)
    return { success: true }
  })

  ipcMain.handle('get-summary', () => {
    const totalExpenses = readJSON('transactions.json')
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
    return { totalExpenses }
  })
}

module.exports = { register }
