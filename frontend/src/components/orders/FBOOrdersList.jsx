import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { FiRefreshCw, FiEye, FiTruck } from 'react-icons/fi'
import { toast } from 'sonner'

function FBOOrdersList() {
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
      
      const response = await api.get(`/api/orders/fbo?${params.toString()}`)
      setOrders(response.data)
    } catch (error) {
      console.error('Failed to load FBO orders:', error)
      toast.error('Ошибка загрузки заказов FBO')
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      const response = await api.post('/api/orders/fbo/sync', {
        marketplace: 'all',
        force: false
      })
      toast.success(`Синхронизация завершена: ${response.data.synced} новых, ${response.data.updated} обновлено`)
      await loadOrders()
    } catch (error) {
      console.error('Failed to sync FBO orders:', error)
      toast.error('Ошибка синхронизации')
    } finally {
      setSyncing(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      'processing': { color: 'text-mm-blue border-mm-blue', label: 'Обработка' },
      'shipped': { color: 'text-mm-cyan border-mm-cyan', label: 'Отправлен' },
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

  return (
    <div className="space-y-4" data-testid="fbo-orders-list">
      <div className="bg-mm-purple/10 border border-mm-purple p-4 rounded">
        <p className="text-sm text-mm-text-secondary font-mono">
          <span className="text-mm-purple font-bold">ℹ️ FBO заказы:</span> Заказы со складов маркетплейсов. Отображаются только для аналитики, не влияют на остатки вашего склада.
        </p>
      </div>

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
              <option value="processing">Обработка</option>
              <option value="shipped">Отправлен</option>
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
          Найдено заказов: <span className="text-mm-purple">{orders.length}</span>
        </p>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn-neon flex items-center space-x-2"
          data-testid="sync-fbo-orders"
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
          <FiTruck className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2 font-mono">Заказы FBO не найдены</p>
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
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Склад МП</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Дата</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Товары</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Сумма</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Статус</th>
                  <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Действия</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors" data-testid={`order-row-${order.id}`}>
                    <td className="py-4 px-4 font-mono text-sm text-mm-purple">
                      {order.order_number}
                    </td>
                    <td className="py-4 px-4 font-mono text-sm uppercase">
                      {order.marketplace}
                    </td>
                    <td className="py-4 px-4 font-mono text-sm">
                      {order.warehouse_name}
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

export default FBOOrdersList
