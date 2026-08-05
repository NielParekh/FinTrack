const { shell } = require('electron')
const { readJSON, writeJSON } = require('./data')
const { getPlaidClient, encryptToken } = require('./plaid')

function plaidError(err) {
  const msg = err?.response?.data?.error_message || err.message || 'Plaid request failed'
  return new Error(msg)
}

// OAuth institutions (Chase, Amex, Wealthfront) block Electron's embedded
// window, so every link flow runs through Plaid Hosted Link in the user's
// default browser and polls for the result.
let hostedLinkAborted = false

function abortHostedLink() {
  hostedLinkAborted = true
}

async function runHostedLink(extraConfig, resolveSession) {
  const client = getPlaidClient()
  const res = await client.linkTokenCreate({
    user: { client_user_id: 'fintrack-local-user' },
    client_name: 'FinTrack',
    country_codes: ['US'],
    language: 'en',
    hosted_link: { url_lifetime_seconds: 900 },
    ...extraConfig,
  })
  const linkToken = res.data.link_token
  await shell.openExternal(res.data.hosted_link_url)

  hostedLinkAborted = false
  const deadline = Date.now() + 15 * 60 * 1000
  while (Date.now() < deadline) {
    if (hostedLinkAborted) return { cancelled: true }
    await new Promise(r => setTimeout(r, 3000))
    const status = await client.linkTokenGet({ link_token: linkToken })
    for (const session of status.data.link_sessions || []) {
      const result = await resolveSession(session)
      if (result) return result
      if ((session.events || []).some(e => e.event_name === 'EXIT')) {
        return { cancelled: true }
      }
    }
  }
  return { cancelled: true, timeout: true }
}

// Exchanges a public token and stores the item. `extra` lets callers tag the
// item (e.g. kind: 'brokerage') so syncs can tell card and brokerage apart.
async function exchangeAndStore(publicToken, institutionName, extra = {}) {
  const client = getPlaidClient()
  const exchange = await client.itemPublicTokenExchange({ public_token: publicToken })
  const accessToken = exchange.data.access_token
  const itemId = exchange.data.item_id

  const accountsRes = await client.accountsGet({ access_token: accessToken })
  const accounts = accountsRes.data.accounts.map(a => ({
    id: a.account_id,
    name: a.name,
    mask: a.mask,
    type: a.subtype || a.type,
  }))

  const items = readJSON('plaid_items.json')
  const { token, enc } = encryptToken(accessToken)
  items.push({
    item_id: itemId,
    access_token: token,
    enc,
    institution: institutionName || 'Bank',
    accounts,
    cursor: null,
    added_at: new Date().toISOString(),
    status: 'ok',
    ...extra,
  })
  writeJSON('plaid_items.json', items)
  return { item_id: itemId, institution: institutionName, accounts }
}

module.exports = { runHostedLink, abortHostedLink, exchangeAndStore, plaidError }
