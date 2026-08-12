const { ipcMain } = require('electron')
const log = require('../lib/logger')
const { readJSON, writeJSON, getNextId, appendSnapshot } = require('../lib/data')
const { getPlaidClient, decryptToken } = require('../lib/plaid')

// Cash accounts at a brokerage (e.g. Wealthfront's Cash Account) report as
// depository, not investment — Plaid gives their subtype as checking/savings.
const CASH_SUBTYPES = new Set(['checking', 'savings', 'money market', 'cash management'])

function isCashAccount(a) {
  return a.type === 'depository' || CASH_SUBTYPES.has(a.subtype || a.type)
}

// Resolves the account to treat as the HYSA. Prefers the id pinned by a
// previous sync; falls back to type detection because re-linking an item
// issues new account ids, which would otherwise silently break the sync.
function resolveCashAccount(accounts, pinnedId) {
  if (pinnedId) {
    const pinned = accounts.find(a => a.account_id === pinnedId)
    if (pinned) return pinned
  }
  return accounts.find(isCashAccount) || null
}

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
    inv.hysa_cost_basis = (inv.hysa_cost_basis || 0) + delta
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

  // Reports which linked item (if any) can supply a HYSA balance, so the UI
  // can show the sync button only when it would actually work.
  ipcMain.handle('get-hysa-source', () => {
    const inv = readJSON('investments.json')
    for (const item of readJSON('plaid_items.json')) {
      if (item.kind !== 'brokerage') continue
      const account = resolveCashAccount(
        (item.accounts || []).map(a => ({ ...a, account_id: a.id })),
        inv.hysa_account_id
      )
      if (account) {
        return {
          institution: item.institution,
          account: account.name,
          mask: account.mask || null,
          synced_at: inv.hysa_synced_at || null,
        }
      }
    }
    return null
  })

  // Pulls the current balance from the linked cash account. Only overwrites
  // hysa_balance — principal stays manual, since Plaid reports what the
  // account holds, not how much of it was deposited vs. earned as interest.
  ipcMain.handle('sync-hysa-balance', async () => {
    const inv = readJSON('investments.json')
    const items = readJSON('plaid_items.json')
    const brokerages = items.filter(i => i.kind === 'brokerage')
    if (!brokerages.length) throw new Error('No linked account to sync from.')

    const client = getPlaidClient()
    let lastError = null

    for (const item of brokerages) {
      let accounts
      try {
        const res = await client.accountsBalanceGet({ access_token: decryptToken(item) })
        accounts = res.data.accounts
      } catch (err) {
        lastError = err?.response?.data?.error_message || err.message
        item.status = 'error'
        item.error = err?.response?.data?.error_code || err.message
        log.error(`HYSA balance fetch failed for ${item.institution}:`, item.error)
        continue
      }

      const account = resolveCashAccount(accounts, inv.hysa_account_id)
      if (!account) continue

      const balance = account.balances?.current
      if (balance == null) {
        lastError = `${item.institution} reported no balance for ${account.name}.`
        continue
      }

      const previous = inv.hysa_balance || 0
      inv.hysa_balance = balance
      // Pin the resolved account so later syncs stay on the same one even if
      // another cash account is linked afterwards.
      inv.hysa_account_id = account.account_id
      inv.hysa_synced_at = new Date().toISOString()
      inv.last_updated = new Date().toISOString()
      writeJSON('investments.json', inv)
      appendSnapshot(inv)

      item.status = 'ok'
      delete item.error
      writeJSON('plaid_items.json', items)

      log.info(
        `HYSA balance synced from ${item.institution}: ` +
        `${previous.toFixed(2)} -> ${balance.toFixed(2)}`
      )
      return {
        hysa_balance: balance,
        previous,
        institution: item.institution,
        account: account.name,
      }
    }

    writeJSON('plaid_items.json', items)
    throw new Error(lastError || 'No cash account found on your linked brokerage.')
  })

  ipcMain.handle('delete-hysa-transaction', (_, id) => {
    const txs = readJSON('hysa_transactions.json')
    const idx = txs.findIndex(t => t.id === id)
    if (idx === -1) throw new Error('Transaction not found')

    const tx = txs[idx]
    const delta = tx.type === 'deposit' ? -tx.amount : tx.amount
    const inv = readJSON('investments.json')
    inv.hysa_balance = (inv.hysa_balance || 0) + delta
    inv.hysa_cost_basis = (inv.hysa_cost_basis || 0) + delta
    inv.last_updated = new Date().toISOString()
    writeJSON('investments.json', inv)

    txs.splice(idx, 1)
    writeJSON('hysa_transactions.json', txs)
    return { hysa_balance: inv.hysa_balance }
  })
}

module.exports = { register }
