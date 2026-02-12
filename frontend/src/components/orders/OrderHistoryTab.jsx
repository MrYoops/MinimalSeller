import React from 'react'
import { FiClock, FiUser } from 'react-icons/fi'

function OrderHistoryTab({ history }) {
  const getActionLabel = (action) => {
    const actions = {
      'status_changed': 'Изменение статуса',
      'split': 'Разделение заказа',
      'label_printed': 'Печать этикетки',
      'label_refreshed': 'Обновление этикетки',
      'note_added': 'Добавлена заметка',
      'created': 'Создан'
    }
    return actions[action] || action
  }

  const formatDetails = (entry) => {
    if (entry.details) {
      return JSON.stringify(entry.details, null, 2)
    }
    return entry.comment || '-'
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-12" data-testid="order-history-tab">
        <FiClock className="mx-auto text-mm-text-tertiary mb-4" size={48} />
        <p className="text-mm-text-secondary font-mono mb-2">// История изменений пуста</p>
        <p className="text-sm text-mm-text-tertiary font-mono">Действия с заказом будут отображаться здесь</p>
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="order-history-tab">
      <h3 className="text-sm uppercase font-mono text-mm-cyan mb-4">// История изменений</h3>
      
      <div className="space-y-3">
        {history.map((entry, idx) => (
          <div key={idx} className="border border-mm-border rounded-lg p-4 hover:bg-mm-border/10 transition-colors" data-testid={`history-entry-${idx}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-mm-cyan/10 rounded">
                  <FiClock className="text-mm-cyan" size={16} />
                </div>
                <div>
                  <p className="text-sm font-mono text-mm-text">
                    {getActionLabel(entry.action || 'status_changed')}
                  </p>
                  <p className="text-xs text-mm-text-secondary font-mono">
                    {new Date(entry.changed_at || entry.timestamp).toLocaleString('ru-RU')}
                  </p>
                </div>
              </div>
              
              {entry.changed_by && (
                <div className="flex items-center space-x-2 text-xs text-mm-text-secondary font-mono">
                  <FiUser size={12} />
                  <span>{entry.changed_by}</span>
                </div>
              )}
            </div>

            {entry.status && (
              <div className="mt-3 pl-11">
                <p className="text-xs text-mm-text-secondary uppercase font-mono mb-1">// Статус</p>
                <p className="text-sm font-mono text-mm-cyan">{entry.status}</p>
              </div>
            )}

            {entry.comment && (
              <div className="mt-3 pl-11">
                <p className="text-xs text-mm-text-secondary uppercase font-mono mb-1">// Комментарий</p>
                <p className="text-sm font-mono text-mm-text">{entry.comment}</p>
              </div>
            )}

            {entry.details && (
              <div className="mt-3 pl-11">
                <p className="text-xs text-mm-text-secondary uppercase font-mono mb-1">// Детали</p>
                <pre className="text-xs font-mono text-mm-text-tertiary bg-mm-dark p-2 rounded overflow-x-auto">
                  {JSON.stringify(entry.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default OrderHistoryTab
