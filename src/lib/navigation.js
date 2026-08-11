export const NAV_SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard' },
    ],
  },
  {
    id: 'investing',
    label: 'Investing',
    items: [
      { id: 'investments',     label: 'Investments' },
      { id: 'bank',            label: 'Bank' },
      { id: 'stocks',          label: 'Stocks' },
      { id: 'hysa',            label: 'HYSA' },
      { id: 'etfs',            label: 'ETFs' },
      { id: 'portfolio-stats', label: 'Portfolio Stats' },
    ],
  },
  {
    id: 'spending',
    label: 'Spending',
    items: [
      { id: 'spending',          label: 'Overview' },
      { id: 'spending-charts',   label: 'Charts' },
      { id: 'spending-accounts', label: 'Linked Cards' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { id: 'data', label: 'Backup & Restore' },
    ],
  },
]

export const NAV_ITEMS = NAV_SECTIONS.flatMap(s => s.items)

export const PAGE_LABELS = Object.fromEntries(NAV_ITEMS.map(i => [i.id, i.label]))
