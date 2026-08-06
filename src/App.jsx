import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Dashboard from './pages/Dashboard'
import Investments from './pages/Investments'
import Bank from './pages/Bank'
import Stocks from './pages/Stocks'
import HYSA from './pages/HYSA'
import ETFs from './pages/ETFs'
import PortfolioStats from './pages/PortfolioStats'
import Spending from './pages/Spending'
import SpendingCharts from './pages/SpendingCharts'
import SpendingAccounts from './pages/SpendingAccounts'

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [theme, setTheme] = useState(() => localStorage.getItem('fintrack-theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('fintrack-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  function renderPage() {
    switch (activeTab) {
      case 'dashboard':      return <Dashboard setActiveTab={setActiveTab} />
      case 'investments':    return <Investments />
      case 'bank':           return <Bank />
      case 'stocks':         return <Stocks />
      case 'hysa':           return <HYSA />
      case 'etfs':           return <ETFs />
      case 'portfolio-stats': return <PortfolioStats />
      case 'spending':          return <Spending />
      case 'spending-charts':   return <SpendingCharts />
      case 'spending-accounts': return <SpendingAccounts />
      default:               return null
    }
  }

  return (
    <div className="shell">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} toggleTheme={toggleTheme} />
      <div className="main">
        <Topbar activeTab={activeTab} />
        <div className="content">
          {renderPage()}
        </div>
      </div>
    </div>
  )
}
