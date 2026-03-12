const https = require('https')

function fetchPrice(ticker) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'query1.finance.yahoo.com',
      path: `/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    }

    https.get(options, (res) => {
      let raw = ''
      res.on('data', chunk => raw += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(raw)
          resolve(json.chart?.result?.[0]?.meta?.regularMarketPrice ?? null)
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

module.exports = { fetchPrices }
