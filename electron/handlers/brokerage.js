const { ipcMain } = require('electron')
const { readJSON, writeJSON } = require('../lib/data')
const { getPlaidClient, decryptToken } = require('../lib/plaid')
const { runHostedLink, exchangeAndStore, plaidError } = require('../lib/plaidLink')

// Plaid's security type for funds; anything else is treated as a stock
const ETF_TYPES = new Set(['etf', 'mutual fund'])

function toHolding(h, security, accountName) {
  const ticker = security?.ticker_symbol || security?.name || 'UNKNOWN'
  return {
    ticker: ticker.toUpperCase(),
    name: security?.name || null,
    shares: h.quantity,
    cost_basis: h.cost_basis ?? null,
    price: h.institution_price ?? null,
    value: h.institution_value ?? null,
    type: ETF_TYPES.has(security?.type) ? 'etf' : 'stock',
    account: accountName,
    currency: h.iso_currency_code || 'USD',
  }
}

async function fetchHoldingsForItem(item) {
  const client = getPlaidClient()
  const res = await client.investmentsHoldingsGet({ access_token: decryptToken(item) })
  const securities = new Map(res.data.securities.map(s => [s.security_id, s]))
  const accounts = new Map(res.data.accounts.map(a => [a.account_id, a.name]))

  return res.data.holdings
    // Brokerages report uninvested cash as a holding (ticker CUR:USD) —
    // it's a balance, not a position
    .filter(h => securities.get(h.security_id)?.type !== 'cash')
    .map(h => toHolding(h, securities.get(h.security_id), accounts.get(h.account_id)))
}

function register() {
  // Brokerage items are stored alongside card items but flagged, so the
  // spending sync never tries to pull transactions from them.
  ipcMain.handle('link-brokerage-hosted', async () => {
    try {
      return await runHostedLink(
        { products: ['investments'] },
        async session => {
          const added = session.results?.item_add_results || []
          if (!added.length) return null
          return exchangeAndStore(added[0].public_token, added[0].institution?.name, {
            kind: 'brokerage',
          })
        }
      )
    } catch (err) {
      throw plaidError(err)
    }
  })

  ipcMain.handle('get-brokerage-accounts', () => {
    return readJSON('plaid_items.json')
      .filter(i => i.kind === 'brokerage')
      .map(({ access_token, enc, ...rest }) => rest)
  })

  ipcMain.handle('sync-holdings', async () => {
    const items = readJSON('plaid_items.json')
    const brokerages = items.filter(i => i.kind === 'brokerage')
    if (!brokerages.length) return { holdings: 0, errors: [] }

    const all = []
    const errors = []
    for (const item of brokerages) {
      try {
        const holdings = await fetchHoldingsForItem(item)
        for (const h of holdings) all.push({ ...h, institution: item.institution })
        item.status = 'ok'
        item.last_synced = new Date().toISOString()
        delete item.error
      } catch (err) {
        item.status = 'error'
        item.error = err?.response?.data?.error_code || err.message
        errors.push(`${item.institution}: ${item.error}`)
      }
    }

    writeJSON('plaid_items.json', items)
    // Only overwrite stored holdings if at least one item synced cleanly,
    // so a transient failure doesn't wipe the last good snapshot.
    if (all.length || !errors.length) {
      writeJSON('plaid_holdings.json', {
        holdings: all,
        synced_at: new Date().toISOString(),
      })
    }
    return { holdings: all.length, errors }
  })

  ipcMain.handle('get-holdings', () => {
    return readJSON('plaid_holdings.json')
  })

  ipcMain.handle('remove-brokerage', async (_, itemId) => {
    const items = readJSON('plaid_items.json')
    const idx = items.findIndex(i => i.item_id === itemId && i.kind === 'brokerage')
    if (idx === -1) throw new Error('Brokerage not found')

    try {
      await getPlaidClient().itemRemove({ access_token: decryptToken(items[idx]) })
    } catch {
      // Item may already be invalid on Plaid's side; still remove locally
    }
    const institution = items[idx].institution
    items.splice(idx, 1)
    writeJSON('plaid_items.json', items)

    // Drop this institution's holdings from the stored snapshot
    const stored = readJSON('plaid_holdings.json')
    const remaining = (stored.holdings || []).filter(h => h.institution !== institution)
    writeJSON('plaid_holdings.json', { ...stored, holdings: remaining })
    return { success: true }
  })
}

module.exports = { register }
