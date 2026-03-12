const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')

const isDev = !app.isPackaged

const ALLOWED_CATEGORIES = new Set(['Food', 'Rent', 'Travel', 'Misc'])

// Data directory — userData in production, local data/ in dev
function getDataDir() {
  if (isDev) {
    return path.join(__dirname, '..', 'data')
  }
  return path.join(app.getPath('userData'), 'data')
}

function ensureDataDir() {
  const dir = getDataDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // On first production run, copy bundled data files into userData
  if (!isDev) {
    const resourcesData = path.join(process.resourcesPath, 'data')
    const files = ['transactions.json', 'investments.json', 'investment_history.json']
    for (const file of files) {
      const dest = path.join(dir, file)
      if (!fs.existsSync(dest)) {
        const src = path.join(resourcesData, file)
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest)
        }
      }
    }
  }

  // Initialize missing files with defaults
  const txFile = path.join(dir, 'transactions.json')
  if (!fs.existsSync(txFile)) fs.writeFileSync(txFile, '[]', 'utf8')

  const invFile = path.join(dir, 'investments.json')
  if (!fs.existsSync(invFile)) {
    fs.writeFileSync(invFile, JSON.stringify({
      bank_balance: 0.0,
      hysa_balance: 0.0,
      stock_value: 0.0,
      stock_cost_basis: 0.0,
      hysa_cost_basis: 0.0,
      etf_cost_basis: 0.0,
      etfs: {},
      stocks: {},
      last_updated: null
    }, null, 2), 'utf8')
  }

  const histFile = path.join(dir, 'investment_history.json')
  if (!fs.existsSync(histFile)) fs.writeFileSync(histFile, '[]', 'utf8')

  const hysaFile = path.join(dir, 'hysa_transactions.json')
  if (!fs.existsSync(hysaFile)) fs.writeFileSync(hysaFile, '[]', 'utf8')
}

// File helpers
function readJSON(filename) {
  try {
    const content = fs.readFileSync(path.join(getDataDir(), filename), 'utf8')
    return JSON.parse(content)
  } catch {
    return filename === 'transactions.json' || filename === 'investment_history.json' ? [] : {}
  }
}

function writeJSON(filename, data) {
  fs.writeFileSync(path.join(getDataDir(), filename), JSON.stringify(data, null, 2), 'utf8')
}

function getNextId(transactions) {
  if (!transactions.length) return 1
  return Math.max(...transactions.map(t => t.id)) + 1
}

function historySnapshot(data) {
  const etfTotal = Object.values(data.etfs || {}).reduce((s, v) => s + v, 0)
  return {
    date: new Date().toISOString().slice(0, 10),
    bank_balance: data.bank_balance || 0,
    hysa_balance: data.hysa_balance || 0,
    stock_value: data.stock_value || 0,
    etf_total: etfTotal,
    net_worth: (data.bank_balance || 0) + (data.hysa_balance || 0) + (data.stock_value || 0) + etfTotal
  }
}

// Yahoo Finance price fetching (v8 chart API, one request per ticker)
function fetchPrice(ticker) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'query1.finance.yahoo.com',
      path: `/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    }
    https.get(options, (res) => {
      let raw = ''
      res.on('data', chunk => raw += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(raw)
          const price = json.chart?.result?.[0]?.meta?.regularMarketPrice ?? null
          resolve(price)
        } catch {
          resolve(null)
        }
      })
    }).on('error', () => resolve(null))
  })
}

async function fetchPrices(tickers) {
  if (!tickers.length) return {}
  const entries = await Promise.all(tickers.map(async t => [t, await fetchPrice(t)]))
  return Object.fromEntries(entries)
}

// IPC Handlers
ipcMain.handle('get-expenses', () => {
  const transactions = readJSON('transactions.json')
  return transactions
    .filter(t => t.type === 'expense')
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date)
      return (b.created_at || '').localeCompare(a.created_at || '')
    })
})

ipcMain.handle('add-expense', (_, data) => {
  const { amount, category, date } = data
  if (!amount || !date) throw new Error('Missing required fields')
  if (parseFloat(amount) <= 0) throw new Error('Amount must be greater than 0')
  if (!category) throw new Error('Category is required')
  if (!ALLOWED_CATEGORIES.has(category)) throw new Error(`Category must be one of ${[...ALLOWED_CATEGORIES].sort().join(', ')}`)

  const transactions = readJSON('transactions.json')
  const newTx = {
    id: getNextId(transactions),
    type: 'expense',
    amount: parseFloat(amount),
    category,
    date,
    created_at: new Date().toISOString()
  }
  transactions.push(newTx)
  writeJSON('transactions.json', transactions)
  return newTx
})

ipcMain.handle('update-expense', (_, id, data) => {
  const { amount, category, date } = data
  if (!amount || !date) throw new Error('Missing required fields')
  if (parseFloat(amount) <= 0) throw new Error('Amount must be greater than 0')
  if (!category) throw new Error('Category is required')
  if (!ALLOWED_CATEGORIES.has(category)) throw new Error(`Category must be one of ${[...ALLOWED_CATEGORIES].sort().join(', ')}`)

  const transactions = readJSON('transactions.json')
  const idx = transactions.findIndex(t => t.id === id)
  if (idx === -1) throw new Error('Transaction not found')

  transactions[idx] = { ...transactions[idx], amount: parseFloat(amount), category, date }
  writeJSON('transactions.json', transactions)
  return transactions[idx]
})

ipcMain.handle('delete-expense', (_, id) => {
  const transactions = readJSON('transactions.json')
  const idx = transactions.findIndex(t => t.id === id)
  if (idx === -1) throw new Error('Transaction not found')
  transactions.splice(idx, 1)
  writeJSON('transactions.json', transactions)
  return { success: true }
})

ipcMain.handle('get-summary', () => {
  const transactions = readJSON('transactions.json')
  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
  return { totalExpenses }
})

ipcMain.handle('get-investments', () => {
  const data = readJSON('investments.json')
  const etfs = data.etfs || {}
  const etfTotal = Object.values(etfs).reduce((s, v) => s + v, 0)
  const stocks = data.stocks || {}
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
    last_updated: data.last_updated || null
  }
})

ipcMain.handle('update-investments', (_, payload) => {
  const data = readJSON('investments.json')
  if (payload.bank_balance !== undefined) data.bank_balance = parseFloat(payload.bank_balance)
  if (payload.hysa_balance !== undefined) data.hysa_balance = parseFloat(payload.hysa_balance)
  if (payload.stock_value !== undefined) data.stock_value = parseFloat(payload.stock_value)
  if (payload.stock_cost_basis !== undefined) data.stock_cost_basis = parseFloat(payload.stock_cost_basis)
  if (payload.hysa_cost_basis !== undefined) data.hysa_cost_basis = parseFloat(payload.hysa_cost_basis)
  if (payload.etf_cost_basis !== undefined) data.etf_cost_basis = parseFloat(payload.etf_cost_basis)
  data.last_updated = new Date().toISOString()
  writeJSON('investments.json', data)

  const history = readJSON('investment_history.json')
  history.push(historySnapshot(data))
  writeJSON('investment_history.json', history)

  const etfs = data.etfs || {}
  const etfTotal = Object.values(etfs).reduce((s, v) => s + v, 0)
  return {
    bank_balance: data.bank_balance,
    hysa_balance: data.hysa_balance,
    stock_value: data.stock_value,
    etf_total: etfTotal,
    etfs: Object.entries(etfs).map(([ticker, value]) => ({ ticker, value })),
    last_updated: data.last_updated
  }
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

  const history = readJSON('investment_history.json')
  history.push(historySnapshot(data))
  writeJSON('investment_history.json', history)

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

ipcMain.handle('fetch-stock-prices', async (_, tickers) => {
  return fetchPrices(tickers)
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

  const history = readJSON('investment_history.json')
  history.push(historySnapshot(data))
  writeJSON('investment_history.json', history)

  return { success: true }
})

ipcMain.handle('get-investment-history', () => {
  const history = readJSON('investment_history.json')
  const byDate = {}
  for (const entry of history) {
    byDate[entry.date] = entry
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
})

ipcMain.handle('get-hysa-transactions', () => {
  const txs = readJSON('hysa_transactions.json')
  return txs.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date)
    return (b.created_at || '').localeCompare(a.created_at || '')
  })
})

ipcMain.handle('add-hysa-transaction', (_, { amount, type, date, note }) => {
  amount = parseFloat(amount)
  if (!amount || amount <= 0) throw new Error('Amount must be greater than 0')
  if (!['deposit', 'withdrawal'].includes(type)) throw new Error('Invalid type')
  if (!date) throw new Error('Date is required')

  const delta = type === 'deposit' ? amount : -amount

  const inv = readJSON('investments.json')
  inv.hysa_balance = (inv.hysa_balance || 0) + delta
  inv.last_updated = new Date().toISOString()
  writeJSON('investments.json', inv)

  const history = readJSON('investment_history.json')
  history.push(historySnapshot(inv))
  writeJSON('investment_history.json', history)

  const txs = readJSON('hysa_transactions.json')
  const newTx = {
    id: txs.length ? Math.max(...txs.map(t => t.id)) + 1 : 1,
    type,
    amount,
    date,
    note: note || '',
    created_at: new Date().toISOString()
  }
  txs.push(newTx)
  writeJSON('hysa_transactions.json', txs)

  return { transaction: newTx, hysa_balance: inv.hysa_balance }
})

ipcMain.handle('delete-hysa-transaction', (_, id) => {
  const txs = readJSON('hysa_transactions.json')
  const idx = txs.findIndex(t => t.id === id)
  if (idx === -1) throw new Error('Transaction not found')

  const tx = txs[idx]
  const delta = tx.type === 'deposit' ? -tx.amount : tx.amount

  const inv = readJSON('investments.json')
  inv.hysa_balance = (inv.hysa_balance || 0) + delta
  inv.last_updated = new Date().toISOString()
  writeJSON('investments.json', inv)

  txs.splice(idx, 1)
  writeJSON('hysa_transactions.json', txs)

  return { hysa_balance: inv.hysa_balance }
})

// Window
function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setMenuBarVisibility(false)

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  ensureDataDir()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
