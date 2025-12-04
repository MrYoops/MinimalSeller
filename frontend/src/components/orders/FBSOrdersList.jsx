import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { FiDownload, FiEye, FiPackage } from 'react-icons/fi'
import { toast } from 'sonner'
import ImportOrdersModal from './ImportOrdersModal'
import OrderDetailModal from './OrderDetailModal'

function FBSOrdersList() {
  const { api } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

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

  const handleOpenDetail = (order) => {
    setSelectedOrder(order)
    setShowDetailModal(true)
  }

  const handleCloseDetail = () => {
    setShowDetailModal(false)
    setSelectedOrder(null)
  }

  const handleOrderUpdate = () => {
    loadOrders()
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
      
      {/* Кнопка импорта */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-mm-text-secondary font-mono">
          Всего заказов: <span className="text-mm-cyan">{orders.length}</span>
        </p>
        <button
          onClick={() => setShowImportModal(true)}
          className="btn-neon flex items-center space-x-2"
          data-testid="open-import-modal"
        >
          <FiDownload />
          <span>ИМПОРТ ЗАКАЗОВ</span>
        </button>
      </div>

      {/* Список заказов */}
      {loading ? (
        <div className="card-neon text-center py-12">
          <p className="text-mm-cyan animate-pulse font-mono">// Загрузка...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiPackage className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2 font-mono">Заказы FBS не найдены</p>
          <p className="text-sm text-mm-text-tertiary font-mono mb-4">// Нажмите "ИМПОРТ ЗАКАЗОВ" для загрузки</p>
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-neon inline-flex items-center space-x-2"
          >
            <FiDownload />
            <span>ИМПОРТ ЗАКАЗОВ</span>
          </button>
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
                        onClick={() => handleOpenDetail(order)}
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

      {/* Модалка импорта */}
      {showImportModal && (
        <ImportOrdersModal
          type="fbs"
          onClose={() => setShowImportModal(false)}
          onSuccess={loadOrders}
        />
      )}

      {/* Модалка детального просмотра */}
      {showDetailModal && selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          isOpen={showDetailModal}
          onClose={handleCloseDetail}
          onUpdate={handleOrderUpdate}
        />
      )}
    </div>
  )
}

export default FBSOrdersList
