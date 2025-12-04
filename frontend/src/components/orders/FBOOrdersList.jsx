import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { FiDownload, FiEye, FiTruck } from 'react-icons/fi'
import { toast } from 'sonner'

function FBOOrdersList() {
  const { api } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  
  const [importSettings, setImportSettings] = useState({
    marketplace: 'ozon',  // По умолчанию Ozon (только он поддерживает FBO явно)
    date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/orders/fbo')
      setOrders(response.data)
    } catch (error) {
      console.error('Failed to load FBO orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!importSettings.date_from || !importSettings.date_to) {
      toast.error('Выберите период')
      return
    }
    
    try {
      setImporting(true)
      
      const response = await api.post('/api/orders/fbo/import', {
        marketplace: importSettings.marketplace,
        date_from: importSettings.date_from,
        date_to: importSettings.date_to
      })
      
      toast.success(`Загружено ${response.data.imported} FBO заказов (без обновления остатков)`)
      
      // Перезагрузить список
      await loadOrders()
      
    } catch (error) {
      console.error('Failed to import FBO orders:', error)
      toast.error(error.response?.data?.detail || 'Ошибка загрузки заказов FBO')
    } finally {
      setImporting(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      'processing': { color: 'text-mm-blue border-mm-blue', label: 'Обработка' },
      'shipped': { color: 'text-mm-cyan border-mm-cyan', label: 'Отправлен' },
      'delivered': { color: 'text-mm-green border-mm-green', label: 'Доставлен' },
      'cancelled': { color: 'text-mm-red border-mm-red', label: 'Отменён' },
      'imported': { color: 'text-mm-blue border-mm-blue', label: 'Загружен' }
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
      
      {/* ПАНЕЛЬ ЗАГРУЗКИ */}
      <div className="card-neon p-6">
        <h3 className="text-lg font-mono text-mm-purple uppercase mb-4">Загрузка заказов FBO</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-mono text-mm-text-secondary mb-2">Маркетплейс *</label>
            <select
              className="input-neon w-full"
              value={importSettings.marketplace}
              onChange={(e) => setImportSettings({...importSettings, marketplace: e.target.value})}
              data-testid="import-marketplace"
            >
              <option value="ozon">Ozon</option>
            </select>
            <p className="text-xs text-mm-text-tertiary mt-1">// Только Ozon поддерживает FBO явно</p>
          </div>
          <div>
            <label className="block text-sm font-mono text-mm-text-secondary mb-2">Дата от *</label>
            <input
              type="date"
              className="input-neon w-full"
              value={importSettings.date_from}
              onChange={(e) => setImportSettings({...importSettings, date_from: e.target.value})}
              data-testid="import-date-from"
            />
          </div>
          <div>
            <label className="block text-sm font-mono text-mm-text-secondary mb-2">Дата до *</label>
            <input
              type="date"
              className="input-neon w-full"
              value={importSettings.date_to}
              onChange={(e) => setImportSettings({...importSettings, date_to: e.target.value})}
              data-testid="import-date-to"
            />
          </div>
        </div>
        
        <button
          onClick={handleImport}
          disabled={importing}
          className="btn-neon w-full flex items-center justify-center space-x-2"
          data-testid="import-orders-btn"
        >
          <FiDownload />
          <span>{importing ? 'Загрузка заказов...' : 'ЗАГРУЗИТЬ ЗАКАЗЫ FBO'}</span>
        </button>
      </div>

      {/* СПИСОК */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-mm-text-secondary font-mono">
          Всего заказов: <span className="text-mm-purple">{orders.length}</span>
        </p>
      </div>

      {loading ? (
        <div className="card-neon text-center py-12">
          <p className="text-mm-cyan animate-pulse font-mono">// Загрузка...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiTruck className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2 font-mono">Заказы FBO не найдены</p>
          <p className="text-sm text-mm-text-tertiary font-mono">// Используйте форму выше для загрузки</p>
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
