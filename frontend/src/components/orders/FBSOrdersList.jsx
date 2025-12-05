import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { FiDownload, FiEye, FiPackage, FiPrinter, FiRefreshCw } from 'react-icons/fi'
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
  const [refreshingStatuses, setRefreshingStatuses] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadOrders()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [orders, activeStatusFilter, searchQuery])

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
    let filtered = orders
    
    // Фильтр по статусу
    if (activeStatusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === activeStatusFilter)
    }
    
    // Поиск по товару (артикул или название)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(order => {
        // Поиск в артикулах и названиях товаров
        const hasMatchingItem = order.items?.some(item => 
          item.article?.toLowerCase().includes(query) ||
          item.name?.toLowerCase().includes(query)
        )
        
        // Или поиск по номеру заказа
        const matchesOrderNumber = order.order_number?.toLowerCase().includes(query)
        
        return hasMatchingItem || matchesOrderNumber
      })
    }
    
    setFilteredOrders(filtered)
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
      toast.error('Ошибка загрузки этикеток')
    }
  }

  const handleBulkExportExcel = async () => {
    try {
      toast.loading('Подготовка экспорта...')
      
      // Генерация CSV
      const selectedOrders = filteredOrders.filter(o => selectedOrderIds.includes(o.id))
      
      const csvHeaders = [
        'ID заказа',
        'Маркетплейс',
        'Дата создания',
        'Статус',
        'Покупатель',
        'Товары',
        'Сумма',
        'Остаток обновлён'
      ]
      
      const csvRows = selectedOrders.map(order => [
        order.order_number,
        order.marketplace.toUpperCase(),
        new Date(order.created_at).toLocaleString('ru-RU'),
        order.status,
        order.customer?.full_name || '',
        order.items?.map(i => `${i.article} (${i.quantity})`).join('; '),
        order.totals?.total || 0,
        order.stock_updated ? 'Да' : 'Нет'
      ])
      
      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => `\"${cell}\"`).join(','))
      ].join('\n')
      
      // Скачивание файла
      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `orders_fbs_${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      
      toast.dismiss()
      toast.success('Экспорт завершён')
    } catch (error) {
      toast.dismiss()
      toast.error('Ошибка экспорта')
    }
  }

  const handleBulkChangeStatus = () => {
    toast.info('Функция в разработке')
  }

  const handleRefreshStatuses = async () => {
    try {
      setRefreshingStatuses(true)
      toast.loading('Обновление статусов с маркетплейсов...')
      
      const response = await api.post('/api/orders/fbs/refresh-statuses', {})
      
      toast.dismiss()
      toast.success(`Обновлено статусов: ${response.data.updated}`)
      
      // Перезагрузить заказы
      await loadOrders()
      
    } catch (error) {
      toast.dismiss()
      toast.error('Ошибка обновления статусов: ' + (error.response?.data?.detail || error.message))
    } finally {
      setRefreshingStatuses(false)
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
      
      {/* Фильтры по статусам */}
      <StatusFilters
        activeStatus={activeStatusFilter}
        onStatusChange={setActiveStatusFilter}
        stats={stats}
      />
      
      {/* Кнопка импорта */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-mm-text-secondary font-mono">
          Всего заказов: <span className="text-mm-cyan">{filteredOrders.length}</span>
          {selectedOrderIds.length > 0 && (
            <span className="ml-4">
              Выбрано: <span className="text-mm-cyan">{selectedOrderIds.length}</span>
            </span>
          )}
        </p>
        <div className="flex space-x-3">
          <button
            onClick={handleRefreshStatuses}
            disabled={refreshingStatuses}
            className="px-4 py-2 border border-mm-cyan text-mm-cyan rounded hover:bg-mm-cyan/10 transition-colors font-mono text-sm flex items-center space-x-2 disabled:opacity-50"
            data-testid="refresh-statuses-btn"
          >
            <FiRefreshCw className={refreshingStatuses ? 'animate-spin' : ''} />
            <span>{refreshingStatuses ? 'Обновление...' : 'ОБНОВИТЬ СТАТУСЫ'}</span>
          </button>
          
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-neon flex items-center space-x-2"
            data-testid="open-import-modal"
          >
            <FiDownload />
            <span>ИМПОРТ ЗАКАЗОВ</span>
          </button>
        </div>
      </div>

      {/* Список заказов */}
      {loading ? (
        <div className="card-neon text-center py-12">
          <p className="text-mm-cyan animate-pulse font-mono">// Загрузка...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiPackage className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2 font-mono">
            {activeStatusFilter === 'all' ? 'Заказы FBS не найдены' : `Нет заказов со статусом "${activeStatusFilter}"`}
          </p>
          <p className="text-sm text-mm-text-tertiary font-mono mb-4">
            // {activeStatusFilter === 'all' ? 'Нажмите "ИМПОРТ ЗАКАЗОВ" для загрузки' : 'Измените фильтр или импортируйте заказы'}
          </p>
          {activeStatusFilter === 'all' && (
            <button
              onClick={() => setShowImportModal(true)}
              className="btn-neon inline-flex items-center space-x-2"
            >
              <FiDownload />
              <span>ИМПОРТ ЗАКАЗОВ</span>
            </button>
          )}
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-mm-border">
                  <th className="py-4 px-4">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 bg-mm-dark border-mm-border rounded cursor-pointer"
                      data-testid="select-all-checkbox"
                    />
                  </th>
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
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors" data-testid={`order-row-${order.id}`}>
                    <td className="py-4 px-4">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(order.id)}
                        onChange={() => toggleSelectOrder(order.id)}
                        className="w-4 h-4 bg-mm-dark border-mm-border rounded cursor-pointer"
                        data-testid={`select-order-${order.id}`}
                      />
                    </td>
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

      {/* Панель массовых действий */}
      <BulkActionsPanel
        selectedCount={selectedOrderIds.length}
        onPrintLabels={handleBulkPrintLabels}
        onExportExcel={handleBulkExportExcel}
        onChangeStatus={handleBulkChangeStatus}
        onClearSelection={() => setSelectedOrderIds([])}
      />
    </div>
  )
}

export default FBSOrdersList
