export function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function fmtGain(n) {
  if (n == null) return { text: '\u2014', cls: '' }
  const sign = n >= 0 ? '+' : ''
  return { text: `${sign}$${fmt(Math.abs(n))}`, cls: n >= 0 ? 'gain-pos' : 'gain-neg' }
}

export function fmtPct(gain, basis) {
  if (!basis) return '\u2014'
  const pct = (gain / basis) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

// Card payments and refunds move money without spending it. Every spending
// view has to agree on this, or the same month totals differently per page.
export const NON_SPEND = new Set(['Payments', 'Refunds'])

export function isPurchase(tx) {
  return tx.amount > 0 && !NON_SPEND.has(tx.category)
}

// A shared expense hits the card in full but only a fraction of it is mine.
// `amount` stays the real charge so it still reconciles against a statement;
// everything that totals *my* spending goes through here instead.
// split_ways of 0 means none of it is mine — fronted for someone else and
// paid back in full — so it contributes nothing to my spending.
export function myShare(tx) {
  const ways = tx.split_ways
  if (ways === 0) return 0
  return ways > 1 ? tx.amount / ways : tx.amount
}

// YYYY-MM, sliced off the ISO date rather than parsed, so a transaction
// never lands in the wrong month via the local timezone.
export function monthKey(date) {
  return date.slice(0, 7)
}
