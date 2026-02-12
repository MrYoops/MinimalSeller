import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { FiPlus, FiEye, FiShoppingBag } from 'react-icons/fi'
import { toast } from 'sonner'
import RetailOrderForm from './RetailOrderForm'

function RetailOrdersList() {
  const { api } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState({
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
      if (filters.status) params.append('status', filters.status)
      if (filters.date_from) params.append('date_from', filters.date_from)
      if (filters.date_to) params.append('date_to', filters.date_to)
      
      const response = await api.get(`/api/orders/retail?${params.toString()}`)
      setOrders(response.data)
    } catch (error) {
      console.error('Failed to load retail orders:', error)
      toast.error('Ошибка загрузки розничных заказов')
    } finally {
      setLoading(false)
    }
  }

  const handleOrderCreated = () => {
    setShowForm(false)
    loadOrders()
    toast.success('Розничный заказ успешно создан!')
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      'new': { color: 'text-mm-blue border-mm-blue', label: 'Новый' },
      'processing': { color: 'text-mm-yellow border-mm-yellow', label: 'Обработка' },
      'completed': { color: 'text-mm-green border-mm-green', label: 'Завершён' },
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

  if (showForm) {
    return (
      <RetailOrderForm 
        onCancel={() => setShowForm(false)}
        onSuccess={handleOrderCreated}
      />
    )
  }

  return (
    <div className="space-y-4" data-testid="retail-orders-list">
      {/* Фильтры */}
      <div className="card-neon p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <option value="processing">Обработка</option>
              <option value="completed">Завершён</option>
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

      {/* Кнопка создания */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-mm-text-secondary font-mono">
          Найдено заказов: <span className="text-mm-green">{orders.length}</span>
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="btn-neon flex items-center space-x-2"
          data-testid="create-retail-order"
        >
          <FiPlus />
          <span>Создать заказ</span>
        </button>
      </div>

      {/* Таблица заказов */}
      {loading ? (
        <div className="card-neon text-center py-12">
          <p className="text-mm-cyan animate-pulse font-mono">// Загрузка...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiShoppingBag className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2 font-mono">Розничные заказы не найдены</p>
          <p className="text-sm text-mm-text-tertiary font-mono mb-4">// Создайте первый заказ</p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-neon inline-flex items-center space-x-2"
          >
            <FiPlus />
            <span>Создать заказ</span>
          </button>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-mm-border">
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Номер</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Дата</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Клиент</th>
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
                    <td className="py-4 px-4 font-mono text-sm text-mm-green">
                      {order.order_number}
                    </td>
                    <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                      {new Date(order.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="py-4 px-4 font-mono text-sm">
                      {order.customer?.full_name || '-'}
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

export default RetailOrdersList
