export default function Sidebar({ activeTab, setActiveTab }) {
  const items = [
    { id: 'investments', label: 'Investments', icon: '📈' },
    { id: 'portfolio-stats', label: 'Portfolio Stats', icon: '📊' },
    { id: 'transactions', label: 'Expenses', icon: '💳' },
    { id: 'stats', label: 'Stats', icon: '📉' },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">SplitCash</div>
      <nav className="sidebar-nav">
        {items.map(item => (
          <button
            key={item.id}
            className={`nav-item${activeTab === item.id ? ' active' : ''}`}
            onClick={() => setActiveTab(item.id)}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
