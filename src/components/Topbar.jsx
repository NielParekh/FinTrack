import { PAGE_LABELS } from '../lib/navigation'

export default function Topbar({ activeTab, onAddExpense }) {
  return (
    <div className="topbar">
      <div className="topbar-breadcrumb">
        <span className="topbar-app">FinTrack</span>
        <span className="topbar-sep">/</span>
        <span className="topbar-page">{PAGE_LABELS[activeTab]}</span>
      </div>
      {activeTab === 'transactions' && (
        <button className="btn btn-primary" onClick={onAddExpense}>
          + Add expense
        </button>
      )}
    </div>
  )
}
