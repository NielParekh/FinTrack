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
