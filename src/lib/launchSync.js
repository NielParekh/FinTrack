import {
  getInvestments, getHoldings, getSpendingTransactions, getSpendingAccounts,
  getHysaSource, syncTransactions, syncHoldings, syncHysaBalance, updateStockValue,
} from './api'

// Everything the launch summary compares, read the same way before and after
async function snapshot() {
  const [inv, held, txs] = await Promise.all([
    getInvestments(), getHoldings(), getSpendingTransactions(),
  ])
  return {
    txs,
    holdings: held?.holdings || [],
    hysa: inv.hysa_balance || 0,
    // Same sum as the history snapshot, so this matches the Dashboard figure
    netWorth: (inv.bank_balance || 0) + (inv.hysa_balance || 0) + (inv.stock_value || 0) +
      (inv.etf_total || 0) + (inv.brokerage_cash || 0),
  }
}

const holdingKey = h => `${h.institution}|${h.account}|${h.ticker}`

function diffHoldings(before, after) {
  const prev = new Map(before.map(h => [holdingKey(h), h]))
  const next = new Map(after.map(h => [holdingKey(h), h]))
  const changes = []
  for (const [key, h] of next) {
    const old = prev.get(key)
    if (!old) changes.push({ ticker: h.ticker, institution: h.institution, kind: 'new', shares: h.shares })
    else if (Math.abs((h.shares || 0) - (old.shares || 0)) > 1e-6) {
      changes.push({ ticker: h.ticker, institution: h.institution, kind: 'shares', from: old.shares, shares: h.shares })
    }
  }
  for (const [key, h] of prev) {
    if (!next.has(key)) changes.push({ ticker: h.ticker, institution: h.institution, kind: 'closed', from: h.shares })
  }
  const total = list => list.reduce((s, h) => s + (h.value || 0), 0)
  return { changes, valueBefore: total(before), valueAfter: total(after) }
}

function diffTransactions(before, after) {
  const prevIds = new Set(before.map(t => t.id))
  const nextIds = new Set(after.map(t => t.id))
  const arrived = after.filter(t => !prevIds.has(t.id))
  // A charge moving from pending to posted comes back from Plaid as a removal
  // plus an addition; pair them so it isn't reported as new spending.
  const posted = arrived.filter(t => t.pending_transaction_id && prevIds.has(t.pending_transaction_id))
  const replaced = new Set(posted.map(t => t.pending_transaction_id))
  return {
    added: arrived.filter(t => !posted.includes(t)).sort((a, b) => b.date.localeCompare(a.date)),
    posted,
    removed: before.filter(t => !nextIds.has(t.id) && !replaced.has(t.id)),
  }
}

// Runs every sync the app has, one at a time: each handler rewrites
// plaid_items.json from its own earlier read, so running them concurrently
// would let the last writer drop the others' status updates.
export async function syncEverything() {
  const before = await snapshot()
  const errors = []
  const failedBrokerages = new Set()
  let ran = false

  try {
    const res = await syncTransactions()
    errors.push(...(res.errors || []))
    ran = true
  } catch (err) {
    errors.push(`Cards: ${err.message}`)
  }

  try {
    const res = await syncHoldings()
    errors.push(...(res.errors || []))
    // Errors read "Institution: CODE"
    for (const e of res.errors || []) failedBrokerages.add(e.split(':')[0])
    ran = true
    // Mirrors the Stocks page: synced stock values only reach net worth once
    // written back, and that page may not be opened this session.
    const stocks = ((await getHoldings())?.holdings || []).filter(h => h.type === 'stock')
    if (stocks.length) await updateStockValue(stocks.reduce((s, h) => s + (h.value || 0), 0))
  } catch (err) {
    errors.push(`Holdings: ${err.message}`)
  }

  try {
    // Only when an account can actually supply the balance — otherwise the
    // HYSA is tracked by hand and the sync would just throw.
    if (await getHysaSource()) {
      await syncHysaBalance()
      ran = true
    }
  } catch (err) {
    errors.push(`HYSA: ${err.message}`)
  }

  const after = await snapshot()
  const accounts = await getSpendingAccounts()
  const cardNames = {}
  for (const item of accounts) {
    for (const a of item.accounts || []) {
      cardNames[a.id] = a.mask ? `${item.institution} ••${a.mask}` : item.institution
    }
  }

  const txs = diffTransactions(before.txs, after.txs)
  const holdings = diffHoldings(before.holdings, after.holdings)
  // A brokerage that failed drops out of the stored holdings until its next
  // good sync; its error is already listed, so don't also call it all closed.
  holdings.changes = holdings.changes.filter(c => !failedBrokerages.has(c.institution))
  const summary = {
    ran,
    errors,
    cardNames,
    ...txs,
    holdings,
    hysa: { before: before.hysa, after: after.hysa },
    netWorth: { before: before.netWorth, after: after.netWorth },
  }
  summary.hasChanges = txs.added.length > 0 || txs.posted.length > 0 || txs.removed.length > 0 ||
    holdings.changes.length > 0 || Math.abs(summary.hysa.after - summary.hysa.before) >= 0.01
  return summary
}
