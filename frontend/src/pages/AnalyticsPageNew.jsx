// Simplified Analytics Page with 3 tabs: Economics, Orders, Export
import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiDownload, FiPieChart, FiShoppingBag, FiFileText, FiRefreshCw } from 'react-icons/fi'
import { toast } from 'sonner'
import BusinessEconomicsTab from '../components/analytics/BusinessEconomicsTab'

const getDateString = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getFirstDayOfMonth = () => {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  return getDateString(firstDay)
}

const getToday = () => getDateString(new Date())

const formatCurrency = (value) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

// Orders Tab Component
function OrdersTab({ dateFrom, dateTo, api }) {
  const [orders, setOrders] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [marketplace, setMarketplace] = useState('ozon')
  const [deliveryFilter, setDeliveryFilter] = useState('all') // 'all', 'FBS', 'FBO'

  // Фильтрация заказов по типу доставки
  const filteredOrders = React.useMemo(() => {
    if (deliveryFilter === 'all' || marketplace !== 'ozon') {
      return orders
    }
    return orders.filter(o => o.delivery_type === deliveryFilter)
  }, [orders, deliveryFilter, marketplace])

  const loadOrders = async () => {
    setLoading(true)
    try {
      if (marketplace === 'yandex') {
        const response = await api.get('/api/yandex-analytics/orders', {
          params: { date_from: dateFrom, date_to: dateTo }
        })
        setOrders(response.data.orders || [])
        setSummary(null)
      } else if (marketplace === 'ozon') {
        const response = await api.get('/api/business-analytics/orders', {
          params: { date_from: dateFrom, date_to: dateTo }
        })
        setOrders(response.data.orders || [])
        setSummary(response.data.summary || null)
      }
    } catch (error) {
      toast.error('Ошибка загрузки заказов')
      console.error(error)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (dateFrom && dateTo) {
      loadOrders()
    }
  }, [dateFrom, dateTo, marketplace])

  const statusColors = {
    'DELIVERED': 'bg-green-500/20 text-green-400',
    'PROCESSING': 'bg-blue-500/20 text-blue-400',
    'PICKUP': 'bg-yellow-500/20 text-yellow-400',
    'CANCELLED': 'bg-red-500/20 text-red-400',
    'RETURNED': 'bg-orange-500/20 text-orange-400'
  }

  const statusNames = {
    'DELIVERED': 'Доставлено',
    'PROCESSING': 'В обработке',
    'PICKUP': 'В пункте выдачи',
    'CANCELLED': 'Отменено',
    'RETURNED': 'Возврат'
  }

  return (
    <div className="space-y-6">
      {/* Marketplace selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMarketplace('ozon')}
            className={`px-4 py-2 rounded-md font-mono text-sm transition-all ${
              marketplace === 'ozon' ? 'bg-[#005bff] text-white' : 'bg-mm-gray text-mm-text-secondary hover:text-mm-text'
            }`}
          >
            🟠 Ozon
          </button>
          <button
            onClick={() => setMarketplace('yandex')}
            className={`px-4 py-2 rounded-md font-mono text-sm transition-all ${
              marketplace === 'yandex' ? 'bg-yellow-500 text-black' : 'bg-mm-gray text-mm-text-secondary hover:text-mm-text'
            }`}
          >
            🔴 Яндекс.Маркет
          </button>
        </div>
        <button
          onClick={loadOrders}
          disabled={loading}
          className="btn-secondary text-sm px-4 flex items-center gap-2"
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} size={16} />
          Обновить
        </button>
      </div>
      
      {/* Filter by delivery type (FBS/FBO) - только для Ozon */}
      {marketplace === 'ozon' && summary && (
        <div className="flex items-center gap-4">
          <span className="text-mm-text-secondary text-sm">Тип доставки:</span>
          <div className="flex bg-mm-gray rounded overflow-hidden">
            <button
              onClick={() => setDeliveryFilter('all')}
              className={`px-4 py-2 text-sm font-mono transition-colors ${
                deliveryFilter === 'all' ? 'bg-mm-cyan text-mm-black' : 'text-mm-text-secondary hover:text-mm-text'
              }`}
            >
              Все ({summary.total_orders})
            </button>
            <button
              onClick={() => setDeliveryFilter('FBS')}
              className={`px-4 py-2 text-sm font-mono transition-colors ${
                deliveryFilter === 'FBS' ? 'bg-blue-500 text-white' : 'text-mm-text-secondary hover:text-mm-text'
              }`}
            >
              FBS ({summary.fbs_count || 0})
            </button>
            <button
              onClick={() => setDeliveryFilter('FBO')}
              className={`px-4 py-2 text-sm font-mono transition-colors ${
                deliveryFilter === 'FBO' ? 'bg-purple-500 text-white' : 'text-mm-text-secondary hover:text-mm-text'
              }`}
            >
              FBO ({summary.fbo_count || 0})
            </button>
          </div>
        </div>
      )}
      
      {/* Summary for Ozon - ПОЛНАЯ АНАЛИТИКА */}
      {marketplace === 'ozon' && summary && (
        <div className="space-y-4">
          {/* Основные метрики */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="card-neon p-4 text-center">
              <div className="text-xl font-bold text-mm-cyan">{filteredOrders.length}</div>
              <div className="text-xs text-mm-text-secondary">
                Заказов {deliveryFilter !== 'all' && `(${deliveryFilter})`}
              </div>
            </div>
            <div className="card-neon p-4 text-center">
              <div className="text-xl font-bold text-green-400">
                {formatCurrency(filteredOrders.reduce((sum, o) => sum + (o.revenue || 0), 0))}
              </div>
              <div className="text-xs text-mm-text-secondary">Выручка</div>
            </div>
            <div className="card-neon p-4 text-center">
              <div className="text-xl font-bold text-red-400">
                {formatCurrency(filteredOrders.reduce((sum, o) => sum + (o.mp_expenses || 0), 0))}
              </div>
              <div className="text-xs text-mm-text-secondary">Расходы МП</div>
            </div>
            <div className="card-neon p-4 text-center bg-purple-500/10">
              <div className="text-xl font-bold text-purple-400">
                {formatCurrency(filteredOrders.reduce((sum, o) => sum + (o.cogs || 0), 0))}
              </div>
              <div className="text-xs text-mm-text-secondary">Себестоимость</div>
            </div>
            <div className="card-neon p-4 text-center bg-orange-500/10">
              <div className="text-xl font-bold text-orange-400">
                {formatCurrency(filteredOrders.reduce((sum, o) => sum + (o.tax || 0), 0))}
              </div>
              <div className="text-xs text-mm-text-secondary">
                Налог ({summary.tax_info?.name || 'УСН 6%'})
              </div>
            </div>
            <div className="card-neon p-4 text-center col-span-2">
              <div className={`text-xl font-bold ${
                filteredOrders.reduce((sum, o) => sum + (o.profit || 0), 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {formatCurrency(filteredOrders.reduce((sum, o) => sum + (o.profit || 0), 0))}
              </div>
              <div className="text-xs text-mm-text-secondary">Чистая прибыль</div>
            </div>
          </div>
          
          {/* Предупреждение о заказах без себестоимости */}
          {summary.orders_without_cogs > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-sm">
              <span className="text-yellow-400">⚠️ {summary.orders_without_cogs} доставленных заказов без себестоимости.</span>
              <span className="text-mm-text-secondary ml-2">
                Добавьте закупочные цены в разделе "Товары → Закупочные цены"
              </span>
            </div>
          )}
        </div>
      )}

      {/* Orders table */}
      <div className="card-neon overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-mm-gray/50">
              {marketplace === 'ozon' ? (
                <tr>
                  <th className="text-left p-3 font-mono text-mm-cyan text-xs">Номер</th>
                  <th className="text-center p-3 font-mono text-mm-cyan text-xs">Тип</th>
                  <th className="text-left p-3 font-mono text-mm-cyan text-xs">Статус</th>
                  <th className="text-left p-3 font-mono text-mm-cyan text-xs">Товары</th>
                  <th className="text-right p-3 font-mono text-mm-cyan text-xs">Выручка</th>
                  <th className="text-right p-3 font-mono text-mm-cyan text-xs">Расх. МП</th>
                  <th className="text-right p-3 font-mono text-mm-cyan text-xs">COGS</th>
                  <th className="text-right p-3 font-mono text-mm-cyan text-xs">Налог</th>
                  <th className="text-right p-3 font-mono text-mm-cyan text-xs">Прибыль</th>
                </tr>
              ) : (
                <tr>
                  <th className="text-left p-4 font-mono text-mm-cyan">ID</th>
                  <th className="text-left p-4 font-mono text-mm-cyan">Статус</th>
                  <th className="text-left p-4 font-mono text-mm-cyan">Товары</th>
                  <th className="text-right p-4 font-mono text-mm-cyan">Сумма</th>
                  <th className="text-right p-4 font-mono text-mm-cyan">Скидка</th>
                  <th className="text-right p-4 font-mono text-mm-cyan">Субсидия ЯМ</th>
                  <th className="text-left p-4 font-mono text-mm-cyan">Регион</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-mm-text-secondary">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mm-cyan mx-auto mb-2"></div>
                    Загрузка заказов...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-mm-text-secondary">
                    Нет заказов за выбранный период
                  </td>
                </tr>
              ) : marketplace === 'ozon' ? (
                // Ozon orders
                filteredOrders.map((order) => (
                  <tr key={order.id} className="border-t border-mm-border/50 hover:bg-mm-gray/30">
                    <td className="p-3 font-mono text-mm-text text-xs">{order.posting_number}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-mono ${
                        order.delivery_type === 'FBO' 
                          ? 'bg-purple-500/20 text-purple-400' 
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {order.delivery_type || 'FBS'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${statusColors[order.status] || 'bg-gray-500/20'}`}>
                        {statusNames[order.status] || order.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="max-w-[150px]">
                        {order.items?.slice(0, 1).map((item, i) => (
                          <div key={i} className="text-mm-text text-xs truncate">
                            {item.name}
                          </div>
                        ))}
                        {order.items?.length > 1 && (
                          <div className="text-mm-text-secondary text-xs">
                            +{order.items.length - 1} ещё
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono text-green-400 text-xs">
                      {formatCurrency(order.revenue)}
                    </td>
                    <td className="p-3 text-right font-mono text-red-400 text-xs">
                      {formatCurrency(order.mp_expenses)}
                    </td>
                    <td className={`p-3 text-right font-mono text-xs ${order.cogs > 0 ? 'text-purple-400' : 'text-mm-text-tertiary'}`}>
                      {order.cogs > 0 ? formatCurrency(order.cogs) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono text-orange-400 text-xs">
                      {formatCurrency(order.tax)}
                    </td>
                    <td className={`p-3 text-right font-mono text-xs font-bold ${order.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(order.profit)}
                    </td>
                  </tr>
                ))
              ) : (
                // Yandex orders
                orders.map((order) => (
                  <tr key={order.id} className="border-t border-mm-border/50 hover:bg-mm-gray/30">
                    <td className="p-4 font-mono text-mm-text">{order.id}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs ${statusColors[order.status] || 'bg-gray-500/20'}`}>
                        {statusNames[order.status] || order.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="max-w-xs">
                        {order.items?.slice(0, 2).map((item, i) => (
                          <div key={i} className="text-mm-text text-xs truncate">
                            {item.name} × {item.count}
                          </div>
                        ))}
                        {order.items?.length > 2 && (
                          <div className="text-mm-text-secondary text-xs">
                            +{order.items.length - 2} ещё
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right font-mono text-mm-text">
                      {formatCurrency(order.buyer_total)}
                    </td>
                    <td className="p-4 text-right font-mono text-orange-400">
                      {formatCurrency((order.buyer_total_before_discount || 0) - (order.buyer_total || 0))}
                    </td>
                    <td className="p-4 text-right font-mono text-yellow-400">
                      {formatCurrency(order.subsidies || 0)}
                    </td>
                    <td className="p-4 text-mm-text-secondary text-xs">
                      {order.delivery_region}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary for Yandex only (Ozon summary is above) */}
      {marketplace === 'yandex' && orders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-neon p-4">
            <div className="text-mm-text-secondary text-sm">Всего заказов</div>
            <div className="text-2xl font-bold text-mm-text">{orders.length}</div>
          </div>
          <div className="card-neon p-4">
            <div className="text-mm-text-secondary text-sm">Доставлено</div>
            <div className="text-2xl font-bold text-green-500">
              {orders.filter(o => o.status === 'DELIVERED').length}
            </div>
          </div>
          <div className="card-neon p-4">
            <div className="text-mm-text-secondary text-sm">Общая сумма</div>
            <div className="text-2xl font-bold text-mm-cyan">
              {formatCurrency(orders.reduce((sum, o) => sum + (o.buyer_total || 0), 0))}
            </div>
          </div>
          <div className="card-neon p-4">
            <div className="text-mm-text-secondary text-sm">Субсидии ЯМ</div>
            <div className="text-2xl font-bold text-yellow-500">
              {formatCurrency(orders.reduce((sum, o) => sum + (o.subsidies || 0), 0))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Export Tab Component
function ExportTab({ dateFrom, dateTo, api }) {
  const [exporting, setExporting] = useState(false)

  const exportToExcel = async (type, marketplace = 'all') => {
    setExporting(true)
    try {
      const endpoint = type === 'economics' 
        ? '/api/export/economics-excel'
        : '/api/export/transactions-excel'
      
      const response = await api.get(endpoint, {
        params: { date_from: dateFrom, date_to: dateTo, marketplace },
        responseType: 'blob'
      })
      
      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${type}_${dateFrom}_${dateTo}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success('Файл успешно выгружен!')
    } catch (error) {
      toast.error('Ошибка выгрузки: ' + (error.response?.data?.detail || error.message))
    }
    setExporting(false)
  }

  return (
    <div className="space-y-6">
      <div className="card-neon p-6">
        <h3 className="text-lg font-mono text-mm-cyan uppercase mb-4">
          ВЫГРУЗКА ОТЧЁТОВ В EXCEL
        </h3>
        <p className="text-mm-text-secondary mb-6">
          Период: {dateFrom} — {dateTo}
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Economics report */}
          <div className="card-neon p-5 bg-mm-gray/30">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-green-500/20">
                <FiPieChart className="text-green-500" size={24} />
              </div>
              <div className="flex-1">
                <h4 className="text-mm-text font-mono mb-1">Экономика бизнеса</h4>
                <p className="text-mm-text-secondary text-sm mb-3">
                  Сводка по доходам, расходам, прибыли. Детализация по категориям расходов.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => exportToExcel('economics', 'ozon')}
                    disabled={exporting}
                    className="btn-primary text-sm px-3 py-2 flex items-center gap-2"
                  >
                    <FiDownload size={14} />
                    Ozon
                  </button>
                  <button
                    onClick={() => exportToExcel('economics', 'yandex')}
                    disabled={exporting}
                    className="btn-primary text-sm px-3 py-2 flex items-center gap-2"
                  >
                    <FiDownload size={14} />
                    Яндекс
                  </button>
                  <button
                    onClick={() => exportToExcel('economics', 'all')}
                    disabled={exporting}
                    className="btn-secondary text-sm px-3 py-2 flex items-center gap-2"
                  >
                    <FiDownload size={14} />
                    Все МП
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Transactions report */}
          <div className="card-neon p-5 bg-mm-gray/30">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-500/20">
                <FiFileText className="text-blue-500" size={24} />
              </div>
              <div className="flex-1">
                <h4 className="text-mm-text font-mono mb-1">Транзакции</h4>
                <p className="text-mm-text-secondary text-sm mb-3">
                  Все финансовые операции за период. Как в личном кабинете маркетплейса.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => exportToExcel('transactions', 'ozon')}
                    disabled={exporting}
                    className="btn-primary text-sm px-3 py-2 flex items-center gap-2"
                  >
                    <FiDownload size={14} />
                    Ozon
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {exporting && (
          <div className="mt-4 flex items-center gap-2 text-mm-cyan">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-mm-cyan"></div>
            Формирование отчёта...
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="card-neon p-6 bg-mm-gray/20">
        <h4 className="text-mm-text-secondary font-mono uppercase mb-3">
          Что содержат отчёты
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-mm-cyan font-mono mb-2">Экономика бизнеса:</div>
            <ul className="text-mm-text-secondary space-y-1">
              <li>• Сводка: доходы, расходы, прибыль</li>
              <li>• Детализация расходов по категориям</li>
              <li>• Все транзакции за период</li>
              <li>• Для ЯМ: список заказов</li>
            </ul>
          </div>
          <div>
            <div className="text-mm-cyan font-mono mb-2">Транзакции:</div>
            <ul className="text-mm-text-secondary space-y-1">
              <li>• Дата операции</li>
              <li>• Тип операции</li>
              <li>• Сумма</li>
              <li>• Номер отправления</li>
              <li>• Детализация услуг</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// Main Page Component
export default function AnalyticsPageNew() {
  const { api } = useAuth()
  const [activeTab, setActiveTab] = useState('economics')
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth())
  const [dateTo, setDateTo] = useState(getToday())

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-mono text-mm-cyan uppercase tracking-wider mb-2">
          // АНАЛИТИКА
        </h1>
        <p className="text-mm-text-secondary">
          Финансовая аналитика по всем маркетплейсам
        </p>
      </div>

      {/* Date filters */}
      <div className="card-neon p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="text-mm-text-secondary text-sm block mb-1">Период с:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-mm-gray border border-mm-border rounded px-3 py-2 text-mm-text"
            />
          </div>
          <div>
            <label className="text-mm-text-secondary text-sm block mb-1">По:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-mm-gray border border-mm-border rounded px-3 py-2 text-mm-text"
            />
          </div>
          <div className="flex-1"></div>
          <div className="text-mm-text-secondary text-sm">
            {Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24)) + 1} дней
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('economics')}
          className={`px-6 py-3 rounded font-mono text-sm flex items-center gap-2 ${
            activeTab === 'economics' 
              ? 'bg-mm-cyan text-mm-black' 
              : 'bg-mm-gray text-mm-text-secondary hover:bg-mm-border'
          }`}
          data-testid="economics-tab"
        >
          <FiPieChart size={18} />
          ЭКОНОМИКА
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-6 py-3 rounded font-mono text-sm flex items-center gap-2 ${
            activeTab === 'orders' 
              ? 'bg-mm-cyan text-mm-black' 
              : 'bg-mm-gray text-mm-text-secondary hover:bg-mm-border'
          }`}
          data-testid="orders-tab"
        >
          <FiShoppingBag size={18} />
          ЗАКАЗЫ
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`px-6 py-3 rounded font-mono text-sm flex items-center gap-2 ${
            activeTab === 'export' 
              ? 'bg-mm-cyan text-mm-black' 
              : 'bg-mm-gray text-mm-text-secondary hover:bg-mm-border'
          }`}
          data-testid="export-tab"
        >
          <FiDownload size={18} />
          ВЫГРУЗКА
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'economics' && (
        <BusinessEconomicsTab dateFrom={dateFrom} dateTo={dateTo} />
      )}
      {activeTab === 'orders' && (
        <OrdersTab dateFrom={dateFrom} dateTo={dateTo} api={api} />
      )}
      {activeTab === 'export' && (
        <ExportTab dateFrom={dateFrom} dateTo={dateTo} api={api} />
      )}
    </div>
  )
}
