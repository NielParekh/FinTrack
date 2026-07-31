import { NAV_SECTIONS } from '../lib/navigation'

export default function Sidebar({ activeTab, setActiveTab, theme, toggleTheme }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">FinTrack</div>
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map(section => (
          <div key={section.id} className="nav-section">
            <div className="nav-section-label">{section.label}</div>
            {section.items.map(item => (
              <button
                key={item.id}
                className={`nav-item${activeTab === item.id ? ' active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === 'light' ? '🌙' : '☀️'}
          {theme === 'light' ? 'Dark mode' : 'Light mode'}
        </button>
      </div>
    </aside>
  )
}
