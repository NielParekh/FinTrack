const { ipcMain } = require('electron')
const log = require('../lib/logger')
const { readJSON, writeJSON } = require('../lib/data')
const { getPlaidClient, decryptToken } = require('../lib/plaid')
const {
  runHostedLink, abortHostedLink, exchangeAndStore, plaidError,
} = require('../lib/plaidLink')

// Map Plaid personal_finance_category → FinTrack's simple category list
function mapCategory(pfc) {
  if (!pfc) return 'Other'
  const detailed = pfc.detailed || ''
  const primary = pfc.primary || ''
  if (detailed === 'FOOD_AND_DRINK_GROCERIES') return 'Groceries'
  if (detailed === 'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS') return 'Fitness'
  const byPrimary = {
    FOOD_AND_DRINK: 'Dining',
    TRANSPORTATION: 'Transport',
    TRAVEL: 'Travel',
    GENERAL_MERCHANDISE: 'Shopping',
    HOME_IMPROVEMENT: 'Shopping',
    ENTERTAINMENT: 'Entertainment',
    RENT_AND_UTILITIES: 'Bills',
    MEDICAL: 'Health',
    PERSONAL_CARE: 'Personal',
    GENERAL_SERVICES: 'Personal',
    BANK_FEES: 'Fees',
    LOAN_PAYMENTS: 'Payments',
    LOAN_DISBURSEMENTS: 'Payments',
    TRANSFER_IN: 'Payments',
    TRANSFER_OUT: 'Payments',
  }
  return byPrimary[primary] || 'Other'
}

function toStoredTransaction(tx, itemId, merchantMap) {
  const merchant = tx.merchant_name || tx.name || 'Unknown'
  // Negative amount = money back on the card: either a card payment or a
  // refund. Chase reports payments as LOAN_DISBURSEMENTS (not LOAN_PAYMENTS),
  // and the name check catches payments Plaid fails to tag at all. Refunds
  // skip the merchant map so they aren't filed under the spend category.
  const primary = tx.personal_finance_category?.primary
  const isPayment = ['LOAN_PAYMENTS', 'LOAN_DISBURSEMENTS', 'TRANSFER_IN'].includes(primary)
    || /payment[^a-z]*thank\s*you|thank\s*you[^a-z]*payment/i.test(tx.name || '')
  const isRefund = tx.amount < 0 && !isPayment
  const auto = isPayment ? 'Payments' : isRefund ? 'Refunds' : mapCategory(tx.personal_finance_category)
  return {
    id: tx.transaction_id,
    item_id: itemId,
    account_id: tx.account_id,
    date: tx.date,
    name: tx.name,
    merchant,
    amount: tx.amount, // Plaid: positive = money out
    pending: tx.pending,
    plaid_category: tx.personal_finance_category?.detailed || null,
    category: (isRefund || isPayment) ? auto : (merchantMap[merchant] || auto),
    user_category: (isRefund || isPayment) ? null : (merchantMap[merchant] || null),
  }
}

function register() {
  ipcMain.handle('link-card-hosted', async () => {
    try {
      return await runHostedLink(
        { products: ['transactions'], transactions: { days_requested: 730 } },
        async session => {
          const added = session.results?.item_add_results || []
          if (!added.length) return null
          const institution = added[0].institution?.name
          log.info(`Card linked: ${institution || 'unknown institution'}`)
          return exchangeAndStore(added[0].public_token, institution)
        }
      )
    } catch (err) {
      log.error('Card link failed:', err?.response?.data?.error_code || err.message)
      throw plaidError(err)
    }
  })

  // Update mode: re-authenticate an existing item (ITEM_LOGIN_REQUIRED etc.)
  // without unlinking, so its transactions and sync cursor survive.
  ipcMain.handle('relink-card-hosted', async (_, itemId) => {
    try {
      const items = readJSON('plaid_items.json')
      const item = items.find(i => i.item_id === itemId)
      if (!item) throw new Error('Linked card not found')
      const accessToken = decryptToken(item)

      const result = await runHostedLink(
        { access_token: accessToken },
        // Update mode adds no item, so success only shows up in the events
        async session => {
          const ok = (session.events || []).some(
            e => e.event_name === 'SUCCESS' || e.event_name === 'HANDOFF'
          )
          return ok ? { success: true } : null
        }
      )
      if (result.cancelled) return result

      // Confirm the item is healthy again and refresh its account list
      const client = getPlaidClient()
      const accountsRes = await client.accountsGet({ access_token: accessToken })
      item.accounts = accountsRes.data.accounts.map(a => ({
        id: a.account_id,
        name: a.name,
        mask: a.mask,
        type: a.subtype || a.type,
      }))
      item.status = 'ok'
      delete item.error
      writeJSON('plaid_items.json', items)
      log.info(`Card re-linked: ${item.institution}, ${item.accounts.length} accounts`)
      return { success: true, institution: item.institution }
    } catch (err) {
      log.error('Card re-link failed:', err?.response?.data?.error_code || err.message)
      throw plaidError(err)
    }
  })

  ipcMain.handle('cancel-hosted-link', () => {
    abortHostedLink()
    return { success: true }
  })

  ipcMain.handle('get-spending-accounts', () => {
    // Never send access tokens to the renderer; brokerage items live on the
    // Investments side and have no transactions to show here.
    return readJSON('plaid_items.json')
      .filter(i => i.kind !== 'brokerage')
      .map(({ access_token, enc, ...rest }) => rest)
  })

  ipcMain.handle('remove-spending-account', async (_, itemId) => {
    const items = readJSON('plaid_items.json')
    const idx = items.findIndex(i => i.item_id === itemId)
    if (idx === -1) throw new Error('Linked card not found')

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

    const all = readJSON('spending_transactions.json')
    const txs = all.filter(t => t.item_id !== itemId)
    writeJSON('spending_transactions.json', txs)
    log.info(`Card removed: ${institution}, ${all.length - txs.length} transactions deleted`)
    return { success: true }
  })

  ipcMain.handle('sync-transactions', async () => {
    const client = getPlaidClient()
    const items = readJSON('plaid_items.json')
    // Brokerage items are linked for holdings only — no transactions product
    const cardItems = items.filter(i => i.kind !== 'brokerage')
    if (!cardItems.length) {
      log.info('Transaction sync: no linked cards, nothing to do')
      return { added: 0, modified: 0, removed: 0 }
    }

    const cats = readJSON('spending_categories.json')
    const merchantMap = cats.merchant_map || {}
    const txs = readJSON('spending_transactions.json')
    const byId = new Map(txs.map(t => [t.id, t]))
    let added = 0, modified = 0, removed = 0
    const errors = []

    for (const item of cardItems) {
      try {
        const accessToken = decryptToken(item)
        let cursor = item.cursor
        let hasMore = true
        while (hasMore) {
          const res = await client.transactionsSync({
            access_token: accessToken,
            cursor: cursor || undefined,
          })
          const d = res.data
          for (const tx of d.added) {
            if (!byId.has(tx.transaction_id)) added++
            byId.set(tx.transaction_id, toStoredTransaction(tx, item.item_id, merchantMap))
          }
          for (const tx of d.modified) {
            const existing = byId.get(tx.transaction_id)
            const stored = toStoredTransaction(tx, item.item_id, merchantMap)
            // Preserve a manual category choice across updates
            if (existing?.user_category) {
              stored.user_category = existing.user_category
              stored.category = existing.user_category
            }
            // Likewise the split — Plaid re-sends the full charge, and the
            // share of it that's mine is a fact Plaid doesn't know about.
            const ways = existing?.split_ways
            if (ways === 0 || ways > 1) stored.split_ways = ways
            byId.set(tx.transaction_id, stored)
            modified++
          }
          for (const rm of d.removed) {
            if (byId.delete(rm.transaction_id)) removed++
          }
          cursor = d.next_cursor
          hasMore = d.has_more
        }
        item.cursor = cursor
        item.status = 'ok'
        item.last_synced = new Date().toISOString()
        delete item.error
      } catch (err) {
        // ITEM_LOGIN_REQUIRED etc. — mark for re-link, keep other items syncing
        item.status = 'error'
        item.error = err?.response?.data?.error_code || err.message
        log.error(`Transaction sync failed for ${item.institution}:`, item.error)
        errors.push(`${item.institution}: ${item.error}`)
      }
    }
    log.info(
      `Transaction sync: ${cardItems.length} cards, +${added} added, ` +
      `~${modified} modified, -${removed} removed, ${errors.length} errors`
    )

    writeJSON('plaid_items.json', items)
    writeJSON('spending_transactions.json', [...byId.values()])
    return { added, modified, removed, errors }
  })

  ipcMain.handle('get-spending-transactions', () => {
    return readJSON('spending_transactions.json').sort((a, b) => b.date.localeCompare(a.date))
  })

  ipcMain.handle('get-spending-categories', () => {
    return readJSON('spending_categories.json').categories
  })

  ipcMain.handle('set-transaction-category', (_, txId, category, rememberMerchant) => {
    const txs = readJSON('spending_transactions.json')
    const tx = txs.find(t => t.id === txId)
    if (!tx) throw new Error('Transaction not found')

    tx.category = category
    tx.user_category = category

    if (rememberMerchant && tx.merchant) {
      const cats = readJSON('spending_categories.json')
      cats.merchant_map = cats.merchant_map || {}
      cats.merchant_map[tx.merchant] = category
      // Apply to every other transaction from this merchant that the user
      // hasn't manually categorized
      for (const other of txs) {
        if (other.merchant === tx.merchant && !other.user_category) {
          other.category = category
        }
      }
      writeJSON('spending_categories.json', cats)
    }

    writeJSON('spending_transactions.json', txs)
    return { success: true }
  })

  // Shared expenses: `amount` stays the full charge on the card, `split_ways`
  // records how many people it covered. Every spending view divides by it.
  // 0 is the "none of this is mine" case — fronted for someone else and paid
  // back in full — so it counts as zero spend rather than a fraction.
  ipcMain.handle('set-transaction-split', (_, txId, ways) => {
    // Guard the empty string first: Number('') is 0, which would otherwise
    // read as a deliberate "not mine" when the box was merely cleared.
    if (typeof ways === 'string' && ways.trim() === '') throw new Error('Split cannot be blank')
    const n = Math.round(Number(ways))
    if (!Number.isFinite(n) || n < 0) throw new Error('Split must be a whole number of 0 or more')

    const txs = readJSON('spending_transactions.json')
    const tx = txs.find(t => t.id === txId)
    if (!tx) throw new Error('Transaction not found')

    if (n === 1) delete tx.split_ways
    else tx.split_ways = n

    writeJSON('spending_transactions.json', txs)
    return { success: true }
  })
}

module.exports = { register }
