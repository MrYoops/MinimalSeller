import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { FiRefreshCw, FiEye, FiPackage } from 'react-icons/fi'
import { toast } from 'sonner'

function FBSOrdersList() {
  const { api } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [filters, setFilters] = useState({
    marketplace: '',
    status: '',
    date_from: '',
    date_to: ''
  })

  useEffect(() => {
    loadOrders()
  }, [filters])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.marketplace) params.append('marketplace', filters.marketplace)
      if (filters.status) params.append('status', filters.status)
      if (filters.date_from) params.append('date_from', filters.date_from)
      if (filters.date_to) params.append('date_to', filters.date_to)
      
      const response = await api.get(`/api/orders/fbs?${params.toString()}`)
      setOrders(response.data)
    } catch (error) {
      console.error('Failed to load FBS orders:', error)
      toast.error('Ошибка загрузки заказов FBS')
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      const response = await api.post('/api/orders/fbs/sync', {
        marketplace: 'all',
        force: false
      })
      toast.success(`Синхронизация завершена: ${response.data.synced} новых, ${response.data.updated} обновлено`)
      await loadOrders()
    } catch (error) {
      console.error('Failed to sync FBS orders:', error)
      toast.error('Ошибка синхронизации')
    } finally {
      setSyncing(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      'new': { color: 'text-mm-blue border-mm-blue', label: 'Новый' },
      'awaiting_shipment': { color: 'text-mm-yellow border-mm-yellow', label: 'Ожидает отгрузки' },
      'delivering': { color: 'text-mm-cyan border-mm-cyan', label: 'Доставляется' },
      'delivered': { color: 'text-mm-green border-mm-green', label: 'Доставлен' },
      'cancelled': { color: 'text-mm-red border-mm-red', label: 'Отменён' }
    }
    const config = statusConfig[status] || { color: 'text-mm-text-secondary border-mm-border', label: status }
    return (
      <span className={`px-2 py-1 text-xs font-mono border ${config.color} rounded`}>
        {config.label}
      </span>
    )
  }

  const getReserveBadge = (reserveStatus) => {
    const config = {
      'reserved': { color: 'text-mm-yellow border-mm-yellow', label: 'Зарезервирован' },
      'deducted': { color: 'text-mm-green border-mm-green', label: 'Списан' },
      'returned': { color: 'text-mm-blue border-mm-blue', label: 'Возвращён' },
      'none': { color: 'text-mm-text-tertiary border-mm-border', label: '-' }
    }
    const c = config[reserveStatus] || config['none']
    return (
      <span className={`px-2 py-1 text-xs font-mono border ${c.color} rounded`}>
        {c.label}
      </span>
    )
  }

  return (
    <div className="space-y-4" data-testid="fbs-orders-list">
      {/* Фильтры */}
      <div className="card-neon p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-mono text-mm-text-secondary mb-2">Маркетплейс</label>
            <select
              className="input-neon w-full"
              value={filters.marketplace}
              onChange={(e) => setFilters({...filters, marketplace: e.target.value})}
              data-testid="filter-marketplace"
            >
              <option value="">Все</option>
              <option value="ozon">Ozon</option>
              <option value="wb">Wildberries</option>
              <option value="yandex">Yandex Market</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-mono text-mm-text-secondary mb-2">Статус</label>
            <select
              className="input-neon w-full"
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              data-testid="filter-status"
            >
              <option value="">Все</option>
              <option value="new">Новый</option>
              <option value="awaiting_shipment">Ожидает отгрузки</option>
              <option value="delivering">Доставляется</option>
              <option value="delivered">Доставлен</option>
              <option value="cancelled">Отменён</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-mono text-mm-text-secondary mb-2">Дата от</label>
            <input
              type="date"
              className="input-neon w-full"
              value={filters.date_from}
              onChange={(e) => setFilters({...filters, date_from: e.target.value})}
              data-testid="filter-date-from"
            />
          </div>
          <div>
            <label className="block text-sm font-mono text-mm-text-secondary mb-2">Дата до</label>
            <input
              type="date"
              className="input-neon w-full"
              value={filters.date_to}
              onChange={(e) => setFilters({...filters, date_to: e.target.value})}
              data-testid="filter-date-to"
            />
          </div>
        </div>
      </div>

      {/* Кнопка синхронизации */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-mm-text-secondary font-mono">
          Найдено заказов: <span className="text-mm-cyan">{orders.length}</span>
        </p>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn-neon flex items-center space-x-2"
          data-testid="sync-fbs-orders"
        >
          <FiRefreshCw className={syncing ? 'animate-spin' : ''} />
          <span>{syncing ? 'Синхронизация...' : 'Синхронизировать'}</span>
        </button>
      </div>

      {/* Таблица заказов */}
      {loading ? (
        <div className="card-neon text-center py-12">
          <p className="text-mm-cyan animate-pulse font-mono">// Загрузка...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiPackage className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2 font-mono">Заказы FBS не найдены</p>
          <p className="text-sm text-mm-text-tertiary font-mono">// Нажмите "Синхронизировать" для загрузки</p>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-mm-border">
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Номер</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">МП</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Дата</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Товары</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Сумма</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Статус</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Резерв</th>
                  <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Действия</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors" data-testid={`order-row-${order.id}`}>
                    <td className="py-4 px-4 font-mono text-sm text-mm-cyan">
                      {order.order_number}
                    </td>
                    <td className="py-4 px-4 font-mono text-sm uppercase">
                      {order.marketplace}
                    </td>
                    <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                      {new Date(order.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="py-4 px-4 font-mono text-sm">
                      {order.items?.length || 0} шт
                    </td>
                    <td className="py-4 px-4 font-mono text-sm">
                      {order.totals?.total?.toLocaleString('ru-RU')}₽
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="py-4 px-4">
                      {getReserveBadge(order.reserve_status)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        className="btn-neon-sm flex items-center space-x-1 ml-auto"
                        data-testid={`view-order-${order.id}`}
                      >
                        <FiEye size={14} />
                        <span>Детали</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default FBSOrdersList
