import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { FiDownload, FiEye, FiPackage } from 'react-icons/fi'
import { toast } from 'sonner'

function FBSOrdersList() {
  const { api } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  
  const [importSettings, setImportSettings] = useState({
    marketplace: 'all',  // ВЫБОР МАРКЕТПЛЕЙСА!
    date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    update_stock: true
  })

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/orders/fbs')
      setOrders(response.data)
    } catch (error) {
      console.error('Failed to load FBS orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!importSettings.date_from || !importSettings.date_to) {
      toast.error('Выберите период')
      return
    }
    
    if (!importSettings.marketplace) {
      toast.error('Выберите маркетплейс')
      return
    }
    
    try {
      setImporting(true)
      
      const response = await api.post('/api/orders/fbs/import', {
        marketplace: importSettings.marketplace,
        date_from: importSettings.date_from,
        date_to: importSettings.date_to,
        update_stock: importSettings.update_stock
      })
      
      const msg = importSettings.update_stock 
        ? `Загружено ${response.data.imported} заказов, списано ${response.data.stock_updated} товаров`
        : `Загружено ${response.data.imported} заказов (без обновления остатков)`
      
      toast.success(msg)
      
      // Перезагрузить список
      await loadOrders()
      
    } catch (error) {
      console.error('Failed to import orders:', error)
      toast.error(error.response?.data?.detail || 'Ошибка загрузки заказов')
    } finally {
      setImporting(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      'new': { color: 'text-mm-blue border-mm-blue', label: 'Новый' },
      'awaiting_shipment': { color: 'text-mm-yellow border-mm-yellow', label: 'Ожидает отгрузки' },
      'delivering': { color: 'text-mm-cyan border-mm-cyan', label: 'Доставляется' },
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
    <div className="space-y-4" data-testid="fbs-orders-list">
      
      {/* ПАНЕЛЬ ЗАГРУЗКИ ЗАКАЗОВ */}
      <div className="card-neon p-6">
        <h3 className="text-lg font-mono text-mm-cyan uppercase mb-4">Загрузка заказов FBS</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-mono text-mm-text-secondary mb-2">Маркетплейс *</label>
            <select
              className="input-neon w-full"
              value={importSettings.marketplace}
              onChange={(e) => setImportSettings({...importSettings, marketplace: e.target.value})}
              data-testid="import-marketplace"
            >
              <option value="all">Все маркетплейсы</option>
              <option value="ozon">Ozon</option>
              <option value="wb">Wildberries</option>
              <option value="yandex">Yandex Market</option>
            </select>
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
          <div className="flex items-end">
            <label className="flex items-center space-x-3 border border-mm-border p-3 rounded hover:border-mm-cyan transition-colors cursor-pointer w-full">
              <input
                type="checkbox"
                checked={importSettings.update_stock}
                onChange={(e) => setImportSettings({...importSettings, update_stock: e.target.checked})}
                className="toggle-switch"
                data-testid="update-stock-checkbox"
              />
              <div>
                <div className="font-semibold text-mm-text text-sm">Обновить остатки</div>
                <div className="text-xs text-mm-text-tertiary">Списать товары со склада</div>
              </div>
            </label>
          </div>
        </div>
        
        <button
          onClick={handleImport}
          disabled={importing}
          className="btn-neon w-full flex items-center justify-center space-x-2"
          data-testid="import-orders-btn"
        >
          <FiDownload />
          <span>{importing ? 'Загрузка заказов...' : 'ЗАГРУЗИТЬ ЗАКАЗЫ'}</span>
        </button>
      </div>

      {/* СПИСОК ЗАКАЗОВ */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-mm-text-secondary font-mono">
          Всего заказов: <span className="text-mm-cyan">{orders.length}</span>
        </p>
      </div>

      {loading ? (
        <div className="card-neon text-center py-12">
          <p className="text-mm-cyan animate-pulse font-mono">// Загрузка...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiPackage className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2 font-mono">Заказы FBS не найдены</p>
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
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Дата</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Товары</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Сумма</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Статус</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-mono">Остаток обновлён</th>
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
                    <td className="py-4 px-4 text-center">
                      {order.stock_updated ? (
                        <span className="text-mm-green">✓</span>
                      ) : (
                        <span className="text-mm-text-tertiary">-</span>
                      )}
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
