import { useState, useEffect, useRef } from 'react'
import { usePressFeedback } from './lib/usePress'
import { enter } from './lib/motion'
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
  const shellRef = useRef(null)
  const contentRef = useRef(null)

  usePressFeedback(shellRef)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('fintrack-theme', theme)
  }, [theme])

  // Each page arrives along the same short vertical path it would leave by
  useEffect(() => {
    if (contentRef.current) enter(contentRef.current, { y: 6 })
  }, [activeTab])

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
    <div className="shell" ref={shellRef}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} toggleTheme={toggleTheme} />
      <div className="main">
        <Topbar activeTab={activeTab} />
        <div className="content" ref={contentRef}>
          {renderPage()}
        </div>
      </div>
    </div>
  )
}
