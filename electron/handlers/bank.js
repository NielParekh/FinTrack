const { ipcMain } = require('electron')
const log = require('../lib/logger')
const { readJSON, writeJSON, appendSnapshot } = require('../lib/data')
const { getPlaidClient, decryptToken } = require('../lib/plaid')
const {
  runHostedLink, exchangeAndStore, plaidError, toStoredAccount,
} = require('../lib/plaidLink')

// A bank login linked to feed the Bank balance, stored in plaid_items.json as
// kind: 'bank'. Its checking/savings balances sum into bank_balance. If the
// same login also shares a credit card, the spending sync picks up that
// card's transactions — checking activity (paychecks, transfers, card
// payments) is never treated as spending.

const isBank = item => item.kind === 'bank'
// Items linked before `group` was recorded held deposit accounts only
const isDeposit = a => (a.group || 'depository') === 'depository'

const publicItem = ({ access_token, enc, ...rest }) => rest

function register() {
  ipcMain.handle('link-bank-hosted', async () => {
    try {
      return await runHostedLink(
        {
          // A product is required to create an Item, and Balance can't be
          // requested on its own. Transactions is the one that makes Plaid
          // refresh the Item through the day, which keeps the cached balance
          // from accountsGet current without paying for real-time balance
          // calls. 730 days is fixed at link time, so it's requested now in
          // case these transactions are ever wanted — it costs nothing extra.
          products: ['transactions'],
          transactions: { days_requested: 730 },
          // Checking/savings for the balance, plus any credit card at the
          // same bank for Spending. Loans and investments aren't offered.
          account_filters: {
            depository: { account_subtypes: ['all'] },
            credit: { account_subtypes: ['all'] },
          },
        },
        async session => {
          const added = session.results?.item_add_results || []
          if (!added.length) return null
          const institution = added[0].institution?.name
          log.info(`Bank linked: ${institution || 'unknown institution'}`)
          return exchangeAndStore(added[0].public_token, institution, { kind: 'bank' })
        }
      )
    } catch (err) {
      log.error('Bank link failed:', err?.response?.data?.error_code || err.message)
      throw plaidError(err)
    }
  })

  ipcMain.handle('get-bank-accounts', () => {
    const inv = readJSON('investments.json')
    return {
      items: readJSON('plaid_items.json').filter(isBank).map(publicItem),
      synced_at: inv.bank_synced_at || null,
    }
  })

  // Sums the current balance of every deposit account on every linked bank
  // and writes it to bank_balance, which net worth and history already read.
  ipcMain.handle('sync-bank-balance', async () => {
    const items = readJSON('plaid_items.json')
    const banks = items.filter(isBank)
    if (!banks.length) throw new Error('No bank account linked.')

    const client = getPlaidClient()
    const errors = []
    let total = 0
    let synced = 0

    for (const item of banks) {
      try {
        // Cached balances: free, and refreshed by Plaid several times a day
        // for Items with Transactions. Real-time /accounts/balance/get is
        // billed per call, which a launch-time sync would rack up.
        const res = await client.accountsGet({ access_token: decryptToken(item) })
        // Keep every account (a credit card here shows up under Spending),
        // but only deposit accounts count as cash
        item.accounts = res.data.accounts.map(a => ({
          ...toStoredAccount(a),
          balance: a.balances?.current ?? null,
        }))
        total += item.accounts.filter(isDeposit).reduce((s, a) => s + (a.balance || 0), 0)
        item.status = 'ok'
        item.last_synced = new Date().toISOString()
        delete item.error
        synced++
      } catch (err) {
        item.status = 'error'
        item.error = err?.response?.data?.error_code || err.message
        log.error(`Bank balance fetch failed for ${item.institution}:`, item.error)
        errors.push(`${item.institution}: ${err?.response?.data?.error_message || item.error}`)
      }
    }
    writeJSON('plaid_items.json', items)

    // A partial total would understate cash, so keep the last good balance
    // until every linked bank answers
    const inv = readJSON('investments.json')
    const previous = inv.bank_balance || 0
    if (synced === banks.length) {
      inv.bank_balance = Math.round(total * 100) / 100
      inv.bank_synced_at = new Date().toISOString()
      inv.last_updated = inv.bank_synced_at
      writeJSON('investments.json', inv)
      appendSnapshot(inv)
      log.info(`Bank balance synced: ${previous.toFixed(2)} -> ${inv.bank_balance.toFixed(2)}`)
    }
    return { bank_balance: inv.bank_balance || 0, previous, errors }
  })

  ipcMain.handle('remove-bank', async (_, itemId) => {
    const items = readJSON('plaid_items.json')
    const idx = items.findIndex(i => i.item_id === itemId && isBank(i))
    if (idx === -1) throw new Error('Linked bank not found')

    const institution = items[idx].institution
    try {
      await getPlaidClient().itemRemove({ access_token: decryptToken(items[idx]) })
    } catch (err) {
      // Item may already be invalid on Plaid's side; still remove locally
      log.warn(
        `itemRemove failed for ${institution}, removing locally anyway:`,
        err?.response?.data?.error_code || err.message
      )
    }
    items.splice(idx, 1)
    writeJSON('plaid_items.json', items)

    // Any credit card on this login goes with it
    const txs = readJSON('spending_transactions.json')
    writeJSON('spending_transactions.json', txs.filter(t => t.item_id !== itemId))

    // The last synced balance stays as a manual figure; only the sync stops
    if (!items.some(isBank)) {
      const inv = readJSON('investments.json')
      delete inv.bank_synced_at
      writeJSON('investments.json', inv)
    }
    log.info(`Bank removed: ${institution}`)
    return { success: true }
  })
}

module.exports = { register }
