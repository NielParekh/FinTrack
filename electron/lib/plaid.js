const { safeStorage } = require('electron')
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid')

let client = null

function getPlaidClient() {
  if (client) return client
  const { PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV } = process.env
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
    const { app } = require('electron')
    const where = app.isPackaged
      ? `a .env file in ${app.getPath('userData')}`
      : 'the .env file at the project root'
    throw new Error(`Plaid keys missing. Add PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV to ${where}.`)
  }
  const config = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET,
      },
    },
  })
  client = new PlaidApi(config)
  return client
}

// Access tokens are encrypted at rest with the OS keychain when available
// (macOS Keychain via Electron safeStorage), stored base64 in plaid_items.json.
function encryptToken(token) {
  if (safeStorage.isEncryptionAvailable()) {
    return { token: safeStorage.encryptString(token).toString('base64'), enc: true }
  }
  return { token, enc: false }
}

function decryptToken(item) {
  if (item.enc) {
    return safeStorage.decryptString(Buffer.from(item.access_token, 'base64'))
  }
  return item.access_token
}

module.exports = { getPlaidClient, encryptToken, decryptToken }
