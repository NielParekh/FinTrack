const { ipcMain } = require('electron')
const { readJSON, writeJSON, getNextId, appendSnapshot } = require('../lib/data')

function register() {
  ipcMain.handle('get-hysa-transactions', () => {
    return readJSON('hysa_transactions.json').sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date)
      return (b.created_at || '').localeCompare(a.created_at || '')
    })
  })

  ipcMain.handle('add-hysa-transaction', (_, { amount, type, date, note }) => {
    amount = parseFloat(amount)
    if (!amount || amount <= 0) throw new Error('Amount must be greater than 0')
    if (!['deposit', 'withdrawal'].includes(type)) throw new Error('Invalid type')
    if (!date) throw new Error('Date is required')

    const delta = type === 'deposit' ? amount : -amount
    const inv = readJSON('investments.json')
    inv.hysa_balance = (inv.hysa_balance || 0) + delta
    inv.last_updated = new Date().toISOString()
    writeJSON('investments.json', inv)
    appendSnapshot(inv)

    const txs = readJSON('hysa_transactions.json')
    const newTx = {
      id: getNextId(txs),
      type,
      amount,
      date,
      note: note || '',
      created_at: new Date().toISOString(),
    }
    txs.push(newTx)
    writeJSON('hysa_transactions.json', txs)
    return { transaction: newTx, hysa_balance: inv.hysa_balance }
  })

  ipcMain.handle('delete-hysa-transaction', (_, id) => {
    const txs = readJSON('hysa_transactions.json')
    const idx = txs.findIndex(t => t.id === id)
    if (idx === -1) throw new Error('Transaction not found')

    const tx = txs[idx]
    const delta = tx.type === 'deposit' ? -tx.amount : tx.amount
    const inv = readJSON('investments.json')
    inv.hysa_balance = (inv.hysa_balance || 0) + delta
    inv.last_updated = new Date().toISOString()
    writeJSON('investments.json', inv)

    txs.splice(idx, 1)
    writeJSON('hysa_transactions.json', txs)
    return { hysa_balance: inv.hysa_balance }
  })
}

module.exports = { register }
