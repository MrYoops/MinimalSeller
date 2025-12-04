import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { FiDownload, FiEye, FiPackage, FiPrinter } from 'react-icons/fi'
import { toast } from 'sonner'
import ImportOrdersModal from './ImportOrdersModal'
import OrderDetailModal from './OrderDetailModal'
import StatusFilters from './StatusFilters'
import BulkActionsPanel from './BulkActionsPanel'

function FBSOrdersList() {
  const { api } = useAuth()
  const [orders, setOrders] = useState([])
  const [filteredOrders, setFilteredOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [activeStatusFilter, setActiveStatusFilter] = useState('all')
  const [selectedOrderIds, setSelectedOrderIds] = useState([])
  const [stats, setStats] = useState({})

  useEffect(() => {
    loadOrders()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [orders, activeStatusFilter])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/orders/fbs')
      setOrders(response.data)
      calculateStats(response.data)
    } catch (error) {
      console.error('Failed to load FBS orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (ordersList) => {
    const newStats = {
      total: ordersList.length,
      new: 0,
      imported: 0,
      awaiting_shipment: 0,
      delivering: 0,
      delivered: 0,
      cancelled: 0
    }

    ordersList.forEach(order => {
      if (newStats.hasOwnProperty(order.status)) {
        newStats[order.status]++
      }
    })

    setStats(newStats)
  }

  const applyFilters = () => {
    if (activeStatusFilter === 'all') {
      setFilteredOrders(orders)
    } else {
      setFilteredOrders(orders.filter(o => o.status === activeStatusFilter))
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

  const toggleSelectOrder = (orderId) => {
    setSelectedOrderIds(prev => {
      if (prev.includes(orderId)) {
        return prev.filter(id => id !== orderId)
      } else {
        return [...prev, orderId]
      }
    })
  }

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([])
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o.id))
    }
  }

  const handleBulkPrintLabels = async () => {
    try {
      toast.loading('\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u044d\u0442\u0438\u043a\u0435\u0442\u043e\u043a...')
      const response = await api.post('/api/orders/fbs/labels/bulk', {
        order_ids: selectedOrderIds
      })

      // \u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043a\u0430\u0436\u0434\u0443\u044e \u044d\u0442\u0438\u043a\u0435\u0442\u043a\u0443
      response.data.labels.forEach((label, idx) => {
        setTimeout(() => {
          window.open(label.label_url, '_blank')
        }, idx * 500)
      })

      toast.dismiss()
      toast.success(`\u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043e ${response.data.labels.length} \u044d\u0442\u0438\u043a\u0435\u0442\u043e\u043a`)

      if (response.data.errors.length > 0) {
        toast.warning(`\u041e\u0448\u0438\u0431\u043a\u0438: ${response.data.errors.length}`)
      }
    } catch (error) {
      toast.dismiss()
      toast.error('\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u044d\u0442\u0438\u043a\u0435\u0442\u043e\u043a')\n    }\n  }

  const handleBulkExportExcel = async () => {
    try {\n      toast.loading('\u041f\u043e\u0434\u0433\u043e\u0442\u043e\u0432\u043a\u0430 \u044d\u043a\u0441\u043f\u043e\u0440\u0442\u0430...')
      \n      // \u0413\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f CSV\n      const selectedOrders = filteredOrders.filter(o => selectedOrderIds.includes(o.id))\n      \n      const csvHeaders = [\n        'ID \u0437\u0430\u043a\u0430\u0437\u0430',\n        '\u041c\u0430\u0440\u043a\u0435\u0442\u043f\u043b\u0435\u0439\u0441',\n        '\u0414\u0430\u0442\u0430 \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u044f',\n        '\u0421\u0442\u0430\u0442\u0443\u0441',\n        '\u041f\u043e\u043a\u0443\u043f\u0430\u0442\u0435\u043b\u044c',\n        '\u0422\u043e\u0432\u0430\u0440\u044b',\n        '\u0421\u0443\u043c\u043c\u0430',\n        '\u041e\u0441\u0442\u0430\u0442\u043e\u043a \u043e\u0431\u043d\u043e\u0432\u043b\u0451\u043d'\n      ]\n      \n      const csvRows = selectedOrders.map(order => [\n        order.order_number,\n        order.marketplace.toUpperCase(),\n        new Date(order.created_at).toLocaleString('ru-RU'),\n        order.status,\n        order.customer?.full_name || '',\n        order.items?.map(i => `${i.article} (${i.quantity})`).join('; '),\n        order.totals?.total || 0,\n        order.stock_updated ? '\u0414\u0430' : '\u041d\u0435\u0442'\n      ])\n      \n      const csvContent = [\n        csvHeaders.join(','),\n        ...csvRows.map(row => row.map(cell => `\"${cell}\"`).join(','))\n      ].join('\\n')\n      \n      // \u0421\u043a\u0430\u0447\u0438\u0432\u0430\u043d\u0438\u0435 \u0444\u0430\u0439\u043b\u0430\n      const blob = new Blob([\"\\uFEFF\" + csvContent], { type: 'text/csv;charset=utf-8;' })\n      const link = document.createElement('a')\n      link.href = URL.createObjectURL(blob)\n      link.download = `orders_fbs_${new Date().toISOString().split('T')[0]}.csv`\n      link.click()\n      \n      toast.dismiss()\n      toast.success('\u042d\u043a\u0441\u043f\u043e\u0440\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d')\n    } catch (error) {\n      toast.dismiss()\n      toast.error('\u041e\u0448\u0438\u0431\u043a\u0430 \u044d\u043a\u0441\u043f\u043e\u0440\u0442\u0430')\n    }\n  }\n\n  const handleBulkChangeStatus = () => {\n    toast.info('\u0424\u0443\u043d\u043a\u0446\u0438\u044f \u0432 \u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u043a\u0435')\n  }

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
