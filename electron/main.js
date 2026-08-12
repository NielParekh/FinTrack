const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

// In dev the .env sits at the repo root. Packaged, __dirname is inside the
// read-only asar, so look beside the app's resources and in userData — the
// latter is the only writable spot on every platform.
const envCandidates = app.isPackaged
  ? [
      path.join(process.resourcesPath, '.env'),
      path.join(app.getPath('userData'), '.env'),
    ]
  : [path.join(__dirname, '..', '.env')]
for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    require('dotenv').config({ path: candidate })
    break
  }
}

const log = require('./lib/logger')
const { ensureDataDir } = require('./lib/data')
const investments = require('./handlers/investments')
const hysa = require('./handlers/hysa')
const spending = require('./handlers/spending')
const brokerage = require('./handlers/brokerage')
const backup = require('./handlers/backup')
const isDev = !app.isPackaged

log.info(`FinTrack ${app.getVersion()} starting (${isDev ? 'dev' : 'packaged'})`)

// Register all IPC handlers
investments.register()
hysa.register()
spending.register()
brokerage.register()
backup.register()

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    // Packaged builds take their icon from the app bundle (electron-builder
    // installs build/icon.icns); in dev there is no bundle, so point at the
    // PNG, which is what nativeImage can actually decode.
    ...(isDev
      ? { icon: path.join(__dirname, '..', 'build', 'icons', 'icon-512.png') }
      : {}),
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
  // The BrowserWindow icon option is a no-op for the macOS Dock, so set it
  // explicitly. Dev only — packaged builds use the bundle's own icon.
  // Must be the PNG: nativeImage cannot decode .icns, and passing that path
  // throws rather than failing soft.
  if (isDev && process.platform === 'darwin' && app.dock) {
    const devIcon = path.join(__dirname, '..', 'build', 'icons', 'icon-512.png')
    if (fs.existsSync(devIcon)) {
      try {
        app.dock.setIcon(devIcon)
      } catch (err) {
        // Cosmetic only — never let a missing dev icon stop the app booting
        log.warn('Could not set dev dock icon:', err.message)
      }
    }
  }
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
