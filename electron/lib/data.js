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
    const files = ['transactions.json', 'investments.json', 'investment_history.json']
    for (const file of files) {
      const dest = path.join(dir, file)
      if (!fs.existsSync(dest)) {
        const src = path.join(resourcesData, file)
        if (fs.existsSync(src)) fs.copyFileSync(src, dest)
      }
    }
  }

  const defaults = {
    'transactions.json': '[]',
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
  fs.writeFileSync(path.join(getDataDir(), filename), JSON.stringify(data, null, 2), 'utf8')
}

function getNextId(items) {
  if (!items.length) return 1
  return Math.max(...items.map(t => t.id)) + 1
}

function historySnapshot(data) {
  const etfTotal = Object.values(data.etfs || {}).reduce((s, v) => s + v, 0)
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
  history.push(historySnapshot(data))
  writeJSON('investment_history.json', history)
}

module.exports = { ensureDataDir, readJSON, writeJSON, getNextId, appendSnapshot }
