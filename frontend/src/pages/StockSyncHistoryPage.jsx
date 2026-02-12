import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiRefreshCw, FiCheck, FiX, FiFilter } from 'react-icons/fi'
import { toast } from 'sonner'

function StockSyncHistoryPage() {
  const { api } = useAuth()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    marketplace: '',
    status: ''
  })

  useEffect(() => {
    loadHistory()
  }, [filters])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.marketplace) params.append('marketplace', filters.marketplace)
      if (filters.status) params.append('status', filters.status)
      
      const response = await api.get(`/api/stock-sync/history?${params}`)
      setHistory(response.data)
    } catch (error) {
      toast.error('Ошибка загрузки истории')
      console.error(error)
    }
    setLoading(false)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    return date.toLocaleString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-mm-cyan uppercase mb-2">История синхронизации остатков</h2>
          <p className="text-mm-text-secondary text-sm">Логи передачи остатков на маркетплейсы</p>
        </div>
        <button
          onClick={loadHistory}
          className="btn-secondary flex items-center space-x-2"
          data-testid="refresh-btn"
        >
          <FiRefreshCw />
          <span>ОБНОВИТЬ</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card-neon">
        <div className="flex items-center space-x-4">
          <FiFilter className="text-mm-cyan" />
          <select
            value={filters.marketplace}
            onChange={(e) => setFilters({...filters, marketplace: e.target.value})}
            className="input-neon text-sm"
          >
            <option value="">Все маркетплейсы</option>
            <option value="ozon">Ozon</option>
            <option value="wb">Wildberries</option>
            <option value="yandex">Yandex</option>
          </select>
          
          <select
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
            className="input-neon text-sm"
          >
            <option value="">Все статусы</option>
            <option value="success">Успешно</option>
            <option value="failed">Ошибка</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="card-neon text-center py-16">
          <FiRefreshCw className="mx-auto text-mm-text-tertiary mb-6" size={64} />
          <p className="text-mm-text-secondary text-lg mb-2">Нет записей</p>
          <p className="text-sm text-mm-text-tertiary">История синхронизации появится после оприходования</p>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mm-border">
                <th className="text-left py-3 px-3 text-mm-text-secondary uppercase text-xs font-mono">Дата</th>
                <th className="text-left py-3 px-3 text-mm-text-secondary uppercase text-xs font-mono">МП</th>
                <th className="text-left py-3 px-3 text-mm-text-secondary uppercase text-xs font-mono">Склад МП</th>
                <th className="text-left py-3 px-3 text-mm-text-secondary uppercase text-xs font-mono">Артикул</th>
                <th className="text-center py-3 px-3 text-mm-text-secondary uppercase text-xs font-mono">Остаток</th>
                <th className="text-left py-3 px-3 text-mm-text-secondary uppercase text-xs font-mono">Статус</th>
                <th className="text-left py-3 px-3 text-mm-text-secondary uppercase text-xs font-mono">Ошибка</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record) => (
                <tr key={record.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                  <td className="py-3 px-3 font-mono text-xs text-mm-text-secondary">{formatDate(record.synced_at)}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-1 text-xs font-mono uppercase bg-mm-purple/20 text-mm-purple border border-mm-purple">
                      {record.marketplace}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-xs text-mm-text-secondary">{record.marketplace_warehouse_id}</td>
                  <td className="py-3 px-3 font-mono text-xs text-mm-cyan">{record.product_article}</td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-mm-green">{record.quantity_sent}</td>
                  <td className="py-3 px-3">
                    {record.status === 'success' ? (
                      <span className="flex items-center text-mm-green text-xs">
                        <FiCheck className="mr-1" />
                        Успешно
                      </span>
                    ) : (
                      <span className="flex items-center text-mm-red text-xs">
                        <FiX className="mr-1" />
                        Ошибка
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-xs text-mm-red">{record.error_message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default StockSyncHistoryPage
