export const NAV_ITEMS = [
  { id: 'investments',     label: 'Investments' },
  { id: 'bank',            label: 'Bank' },
  { id: 'stocks',          label: 'Stocks' },
  { id: 'hysa',            label: 'HYSA' },
  { id: 'etfs',            label: 'ETFs' },
  { id: 'portfolio-stats', label: 'Portfolio Stats' },
]

export const PAGE_LABELS = Object.fromEntries(NAV_ITEMS.map(i => [i.id, i.label]))
