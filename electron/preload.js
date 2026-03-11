const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getExpenses:          ()           => ipcRenderer.invoke('get-expenses'),
  addExpense:           (data)       => ipcRenderer.invoke('add-expense', data),
  updateExpense:        (id, data)   => ipcRenderer.invoke('update-expense', id, data),
  deleteExpense:        (id)         => ipcRenderer.invoke('delete-expense', id),
  getSummary:           ()           => ipcRenderer.invoke('get-summary'),
  getInvestments:       ()           => ipcRenderer.invoke('get-investments'),
  updateInvestments:    (data)       => ipcRenderer.invoke('update-investments', data),
  upsertEtf:            (t, v)       => ipcRenderer.invoke('upsert-etf', t, v),
  removeEtf:            (ticker)     => ipcRenderer.invoke('remove-etf', ticker),
  getInvestmentHistory: ()           => ipcRenderer.invoke('get-investment-history'),
})
