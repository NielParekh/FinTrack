const path = require('path')
const fs = require('fs')
const { app } = require('electron')

const isDev = !app.isPackaged

function getDataDir() {
  if (isDev) return path.join(__dirname, '..', '..', 'data')
  return path.join(app.getPath('userData'), 'data')
}

function ensureDataDir() {
  const dir = getDataDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  if (!isDev) {
    const resourcesData = path.join(process.resourcesPath, 'data')
    const files = ['investments.json', 'investment_history.json']
    for (const file of files) {
      const dest = path.join(dir, file)
      if (!fs.existsSync(dest)) {
        const src = path.join(resourcesData, file)
        if (fs.existsSync(src)) fs.copyFileSync(src, dest)
      }
    }
  }

  const defaults = {
    'investments.json': JSON.stringify({
      bank_balance: 0.0,
      hysa_balance: 0.0,
      stock_value: 0.0,
      stock_cost_basis: 0.0,
      hysa_cost_basis: 0.0,
      etf_cost_basis: 0.0,
      etfs: {},
      stocks: {},
      last_updated: null,
    }, null, 2),
    'investment_history.json': '[]',
    'hysa_transactions.json': '[]',
    'plaid_items.json': '[]',
    'plaid_holdings.json': JSON.stringify({ holdings: [], synced_at: null }, null, 2),
    'spending_transactions.json': '[]',
    'spending_categories.json': JSON.stringify({
      categories: ['Groceries', 'Dining', 'Transport', 'Travel', 'Shopping', 'Entertainment', 'Bills', 'Health', 'Fitness', 'Personal', 'Fees', 'Refunds', 'Payments', 'Other'],
      merchant_map: {},
    }, null, 2),
  }

  for (const [file, content] of Object.entries(defaults)) {
    const filePath = path.join(dir, file)
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, content, 'utf8')
  }
}

function readJSON(filename) {
  try {
    const content = fs.readFileSync(path.join(getDataDir(), filename), 'utf8')
    return JSON.parse(content)
  } catch {
    return filename.endsWith('s.json') || filename.includes('history') ? [] : {}
  }
}

function writeJSON(filename, data) {
  // Atomic write: write to a temp file then rename, so a crash mid-write
  // can never leave a truncated/corrupted data file.
  const target = path.join(getDataDir(), filename)
  const tmp = target + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tmp, target)
}

function getNextId(items) {
  if (!items.length) return 1
  return Math.max(...items.map(t => t.id)) + 1
}

function historySnapshot(data) {
  // Prefer synced brokerage holdings over the manual etfs object
  const synced = (readJSON('plaid_holdings.json').holdings || []).filter(h => h.type === 'etf')
  const etfTotal = synced.length
    ? synced.reduce((s, h) => s + (h.value || 0), 0)
    : Object.values(data.etfs || {}).reduce((s, v) => s + v, 0)
  return {
    date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
    bank_balance: data.bank_balance || 0,
    hysa_balance: data.hysa_balance || 0,
    stock_value: data.stock_value || 0,
    etf_total: etfTotal,
    net_worth: (data.bank_balance || 0) + (data.hysa_balance || 0) + (data.stock_value || 0) + etfTotal,
  }
}

function appendSnapshot(data) {
  const history = readJSON('investment_history.json')
  const snap = historySnapshot(data)
  const idx = history.findIndex(h => h.date === snap.date)
  if (idx !== -1) {
    history[idx] = snap
  } else {
    history.push(snap)
  }
  writeJSON('investment_history.json', history)
}

module.exports = { ensureDataDir, readJSON, writeJSON, getNextId, appendSnapshot }
