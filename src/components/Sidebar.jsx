export default function Sidebar({ activeTab, setActiveTab }) {
  const items = [
    { id: 'investments', label: 'Investments' },
    { id: 'bank', label: 'Bank' },
    { id: 'stocks', label: 'Stocks' },
    { id: 'hysa', label: 'HYSA' },
    { id: 'etfs', label: 'ETFs' },
    { id: 'portfolio-stats', label: 'Portfolio Stats' },
    { id: 'transactions', label: 'Expenses' },
    { id: 'stats', label: 'Stats' },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">FinTrack</div>
      <nav className="sidebar-nav">
        {items.map(item => (
          <button
            key={item.id}
            className={`nav-item${activeTab === item.id ? ' active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
