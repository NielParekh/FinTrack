const log = require('electron-log')
const { app } = require('electron')

// Packaged builds have no terminal attached, so a crash or a failed Plaid
// call would otherwise leave nothing to inspect. Logs go to:
//   macOS   ~/Library/Logs/FinTrack/main.log
//   Windows %USERPROFILE%\AppData\Roaming\FinTrack\logs\main.log
//   Linux   ~/.config/FinTrack/logs/main.log
log.transports.file.level = 'info'
log.transports.file.maxSize = 5 * 1024 * 1024 // rotates to main.old.log past this
log.transports.console.level = app.isPackaged ? false : 'debug'

// Access tokens and Plaid secrets must never reach the log file. Redact
// anything that looks like one before it's written.
const SECRET_PATTERNS = [
  /access-(sandbox|development|production)-[\w-]+/gi,
  /link-(sandbox|development|production)-[\w-]+/gi,
  /public-(sandbox|development|production)-[\w-]+/gi,
  /\b[0-9a-f]{24,}\b/gi, // client ids / secrets
]

function redact(value) {
  if (typeof value === 'string') {
    return SECRET_PATTERNS.reduce((s, re) => s.replace(re, '[redacted]'), value)
  }
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      // Whole fields that are secrets by name, regardless of shape
      out[k] = /token|secret|password|enc/i.test(k) ? '[redacted]' : redact(v)
    }
    return out
  }
  return value
}

log.hooks.push(message => {
  message.data = message.data.map(redact)
  return message
})

// Anything that escapes a handler still lands in the log rather than
// disappearing silently.
process.on('uncaughtException', err => {
  log.error('Uncaught exception:', err)
})

process.on('unhandledRejection', reason => {
  log.error('Unhandled rejection:', reason)
})

module.exports = log
