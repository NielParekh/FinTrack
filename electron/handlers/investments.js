const { ipcMain } = require('electron')
const { readJSON, writeJSON, appendSnapshot } = require('../lib/data')
const { fetchPrices } = require('../lib/prices')

function formatInvestmentData(data) {
  const etfs = data.etfs || {}
  const stocks = data.stocks || {}
  const etfTotal = Object.values(etfs).reduce((s, v) => s + v, 0)
  return {
    bank_balance: data.bank_balance || 0,
    hysa_balance: data.hysa_balance || 0,
    stock_value: data.stock_value || 0,
    stock_cost_basis: data.stock_cost_basis || 0,
    hysa_cost_basis: data.hysa_cost_basis || 0,
    etf_cost_basis: data.etf_cost_basis || 0,
    etf_total: etfTotal,
    etfs: Object.entries(etfs).map(([ticker, value]) => ({ ticker, value })),
    stocks: Object.entries(stocks).map(([ticker, shares]) => ({ ticker, shares })),
    last_updated: data.last_updated || null,
  }
}

function register() {
  ipcMain.handle('get-investments', () => {
    return formatInvestmentData(readJSON('investments.json'))
  })

  ipcMain.handle('update-investments', (_, payload) => {
    const data = readJSON('investments.json')
    const fields = ['bank_balance', 'hysa_balance', 'stock_value', 'stock_cost_basis', 'hysa_cost_basis', 'etf_cost_basis']
    for (const field of fields) {
      if (payload[field] !== undefined) data[field] = parseFloat(payload[field])
    }
    data.last_updated = new Date().toISOString()
    writeJSON('investments.json', data)
    appendSnapshot(data)
    return formatInvestmentData(data)
  })

  ipcMain.handle('upsert-etf', (_, ticker, value) => {
    ticker = ticker.trim().toUpperCase()
    if (!ticker) throw new Error('Ticker cannot be empty')
    if (parseFloat(value) < 0) throw new Error('Value must be >= 0')

    const data = readJSON('investments.json')
    if (!data.etfs) data.etfs = {}
    data.etfs[ticker] = parseFloat(value)
    data.last_updated = new Date().toISOString()
    writeJSON('investments.json', data)
    appendSnapshot(data)
    return Object.entries(data.etfs).map(([t, v]) => ({ ticker: t, value: v }))
  })

  ipcMain.handle('remove-etf', (_, ticker) => {
    ticker = ticker.trim().toUpperCase()
    const data = readJSON('investments.json')
    if (!data.etfs || !(ticker in data.etfs)) throw new Error(`${ticker} not found`)
    delete data.etfs[ticker]
    writeJSON('investments.json', data)
    return { success: true }
  })

  ipcMain.handle('upsert-stock', (_, ticker, shares) => {
    ticker = ticker.trim().toUpperCase()
    if (!ticker) throw new Error('Ticker cannot be empty')
    shares = parseFloat(shares)
    if (isNaN(shares) || shares <= 0) throw new Error('Shares must be > 0')

    const data = readJSON('investments.json')
    if (!data.stocks) data.stocks = {}
    data.stocks[ticker] = shares
    data.last_updated = new Date().toISOString()
    writeJSON('investments.json', data)
    return Object.entries(data.stocks).map(([t, s]) => ({ ticker: t, shares: s }))
  })

  ipcMain.handle('remove-stock', (_, ticker) => {
    ticker = ticker.trim().toUpperCase()
    const data = readJSON('investments.json')
    if (!data.stocks || !(ticker in data.stocks)) throw new Error(`${ticker} not found`)
    delete data.stocks[ticker]
    data.last_updated = new Date().toISOString()
    writeJSON('investments.json', data)
    return { success: true }
  })

  ipcMain.handle('update-stock-value', (_, value) => {
    const data = readJSON('investments.json')
    data.stock_value = parseFloat(value) || 0
    data.last_updated = new Date().toISOString()
    writeJSON('investments.json', data)
    appendSnapshot(data)
    return { success: true }
  })

  ipcMain.handle('fetch-stock-prices', async (_, tickers) => {
    return fetchPrices(tickers)
  })

  ipcMain.handle('get-investment-history', () => {
    const history = readJSON('investment_history.json')
    const byDate = {}
    for (const entry of history) byDate[entry.date] = entry
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  })
}

module.exports = { register }
