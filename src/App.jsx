import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Expenses from './pages/Expenses'
import Investments from './pages/Investments'
import Bank from './pages/Bank'
import Stocks from './pages/Stocks'
import HYSA from './pages/HYSA'
import ETFs from './pages/ETFs'
import Stats from './pages/Stats'
import PortfolioStats from './pages/PortfolioStats'

export default function App() {
  const [activeTab, setActiveTab] = useState('investments')
  const [showExpenseModal, setShowExpenseModal] = useState(false)

  function renderPage() {
    switch (activeTab) {
      case 'investments':    return <Investments />
      case 'bank':           return <Bank />
      case 'stocks':         return <Stocks />
      case 'hysa':           return <HYSA />
      case 'etfs':           return <ETFs />
      case 'portfolio-stats': return <PortfolioStats />
      case 'transactions':   return (
        <Expenses
          showModal={showExpenseModal}
          onModalClose={() => setShowExpenseModal(false)}
        />
      )
      case 'stats':          return <Stats />
      default:               return null
    }
  }

  return (
    <div className="shell">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="main">
        <Topbar
          activeTab={activeTab}
          onAddExpense={() => setShowExpenseModal(true)}
        />
        <div className="content">
          {renderPage()}
        </div>
      </div>
    </div>
  )
}
