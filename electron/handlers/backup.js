const { ipcMain, dialog, app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const log = require('../lib/logger')
const { readJSON, writeJSON, getDataDir } = require('../lib/data')

const BACKUP_VERSION = 1

// Every file the app owns. Anything absent is skipped, so a backup taken
// before a feature existed still restores cleanly.
const DATA_FILES = [
  'investments.json',
  'investment_history.json',
  'hysa_transactions.json',
  'transactions.json',
  'plaid_items.json',
  'plaid_holdings.json',
  'spending_transactions.json',
  'spending_categories.json',
]

// Plaid access tokens are encrypted with the OS keychain, which is bound to
// this machine and user. A backup restored elsewhere can't decrypt them, so
// the envelope records where it came from and the restore warns on mismatch.
function machineId() {
  return crypto
    .createHash('sha256')
    .update(`${os.hostname()}::${os.userInfo().username}`)
    .digest('hex')
    .slice(0, 16)
}

function readEnvelope(filePath) {
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    throw new Error('That file isn’t valid JSON — it may be corrupted.')
  }
  if (parsed.version !== BACKUP_VERSION || !parsed.files) {
    throw new Error('That doesn’t look like a FinTrack backup.')
  }
  return parsed
}

function snapshot() {
  const files = {}
  for (const name of DATA_FILES) {
    if (fs.existsSync(path.join(getDataDir(), name))) files[name] = readJSON(name)
  }
  return {
    version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    app_version: app.getVersion(),
    platform: process.platform,
    machine_id: machineId(),
    files,
  }
}

function register() {
  ipcMain.handle('export-backup', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(
      BrowserWindow.getFocusedWindow(),
      {
        title: 'Save FinTrack Backup',
        defaultPath: path.join(
          app.getPath('documents'),
          `FinTrack-backup-${new Date().toISOString().slice(0, 10)}.json`
        ),
        filters: [{ name: 'FinTrack Backup', extensions: ['json'] }],
      }
    )
    if (canceled || !filePath) return { cancelled: true }

    const payload = snapshot()
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')

    const bytes = fs.statSync(filePath).size
    log.info(`Backup exported: ${Object.keys(payload.files).length} files, ${bytes} bytes`)
    return { path: filePath, files: Object.keys(payload.files).length, bytes }
  })

  // Reads a backup and reports what it holds, without writing anything, so
  // the UI can show what's about to be replaced before committing to it.
  ipcMain.handle('inspect-backup', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(
      BrowserWindow.getFocusedWindow(),
      {
        title: 'Choose a FinTrack Backup',
        properties: ['openFile'],
        filters: [{ name: 'FinTrack Backup', extensions: ['json'] }],
      }
    )
    if (canceled || !filePaths?.length) return { cancelled: true }

    const filePath = filePaths[0]
    const parsed = readEnvelope(filePath)
    const names = Object.keys(parsed.files).filter(n => DATA_FILES.includes(n))
    if (!names.length) throw new Error('That backup is empty.')

    return {
      path: filePath,
      created_at: parsed.created_at || null,
      app_version: parsed.app_version || null,
      files: names,
      // Tokens only decrypt on the machine that wrote them
      foreign: parsed.machine_id !== machineId(),
      has_plaid: names.includes('plaid_items.json'),
    }
  })

  // Replaces local data with the backup's contents. Snapshots what's there
  // first, so a restore chosen by mistake can be undone.
  ipcMain.handle('restore-backup', async (_, { path: filePath, skipPlaid } = {}) => {
    if (!filePath) throw new Error('No backup selected.')
    const parsed = readEnvelope(filePath)

    // Kept out of the data dir so it's never mistaken for live data
    const undoDir = path.join(app.getPath('userData'), 'pre-restore')
    fs.mkdirSync(undoDir, { recursive: true })
    const undoPath = path.join(
      undoDir,
      `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    )
    fs.writeFileSync(undoPath, JSON.stringify(snapshot(), null, 2), 'utf8')

    let restored = 0
    let skipped = 0
    for (const [name, contents] of Object.entries(parsed.files)) {
      if (!DATA_FILES.includes(name)) continue
      if (skipPlaid && name === 'plaid_items.json') {
        skipped++
        continue
      }
      // Atomic write — a crash mid-restore can't leave a truncated file
      writeJSON(name, contents)
      restored++
    }

    log.info(`Backup restored: ${restored} files, ${skipped} skipped, undo at ${undoPath}`)
    return { restored, skipped, undo_path: undoPath }
  })
}

module.exports = { register }
