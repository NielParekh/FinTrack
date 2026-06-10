import { PAGE_LABELS } from '../lib/navigation'

export default function Topbar({ activeTab }) {
  return (
    <div className="topbar">
      <div className="topbar-breadcrumb">
        <span className="topbar-app">FinTrack</span>
        <span className="topbar-sep">/</span>
        <span className="topbar-page">{PAGE_LABELS[activeTab]}</span>
      </div>
    </div>
  )
}
