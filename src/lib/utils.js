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

// YYYY-MM, sliced off the ISO date rather than parsed, so a transaction
// never lands in the wrong month via the local timezone.
export function monthKey(date) {
  return date.slice(0, 7)
}
