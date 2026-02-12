import React from 'react'

function StatusFilters({ activeStatus, onStatusChange, stats }) {
  const statuses = [
    { key: 'all', label: 'ВСЕ', color: 'text-mm-text' },
    { key: 'new', label: 'НОВЫЙ', color: 'text-mm-blue' },
    { key: 'imported', label: 'ЗАГРУЖЕН', color: 'text-mm-blue' },
    { key: 'awaiting_shipment', label: 'ОЖИДАЕТ ОТГРУЗКИ', color: 'text-mm-yellow' },
    { key: 'delivering', label: 'В ПУТИ', color: 'text-mm-cyan' },
    { key: 'delivered', label: 'ДОСТАВЛЕН', color: 'text-mm-green' },
    { key: 'cancelled', label: 'ОТМЕНЁН', color: 'text-mm-red' }
  ]

  const getCount = (status) => {
    if (status === 'all') {
      return stats.total || 0
    }
    return stats[status] || 0
  }

  return (
    <div className="flex flex-wrap gap-2 mb-6" data-testid="status-filters">
      {statuses.map(status => (
        <button
          key={status.key}
          onClick={() => onStatusChange(status.key)}
          className={`px-4 py-2 rounded border font-mono text-sm transition-all ${
            activeStatus === status.key
              ? `${status.color} border-current bg-current/10`
              : 'text-mm-text-secondary border-mm-border hover:border-mm-text-secondary'
          }`}
          data-testid={`status-filter-${status.key}`}
        >
          {status.label}
          <span className="ml-2 opacity-70">{getCount(status.key)}</span>
        </button>
      ))}
    </div>
  )
}

export default StatusFilters
