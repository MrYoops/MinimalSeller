import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts'
import { 
  FiTrendingUp, FiTrendingDown, FiDollarSign, FiAlertTriangle,
  FiRefreshCw, FiChevronDown, FiChevronUp, FiInfo, FiShoppingCart,
  FiPackage, FiMapPin
} from 'react-icons/fi'

// Marketplace logos/colors
const MARKETPLACE_CONFIG = {
  ozon: { name: 'Ozon', color: '#005bff', icon: '🟠' },
  yandex: { name: 'Яндекс.Маркет', color: '#ffcc00', icon: '🔴' },
  wb: { name: 'Wildberries', color: '#cb11ab', icon: '🟣' }
}

// Color palette for expense categories
const EXPENSE_COLORS = {
  cogs: '#a855f7',           // Purple - себестоимость
  penalties: '#ef4444',      // Red - штрафы
  returns: '#f97316',        // Orange - возвраты
  subscription: '#8b5cf6',   // Purple - подписка
  acquiring: '#3b82f6',      // Blue - эквайринг
  client_compensation: '#ec4899', // Pink - компенсации
  loyalty_points: '#eab308', // Yellow - баллы
  early_payment: '#06b6d4',  // Cyan - ранняя выплата
  logistics: '#22c55e',      // Green - логистика
  storage: '#64748b',        // Gray - хранение
  other: '#9ca3af'           // Light gray - прочее
}

const EXPENSE_LABELS = {
  cogs: 'Себестоимость',
  penalties: 'Штрафы',
  returns: 'Возвраты',
  subscription: 'Подписка',
  acquiring: 'Эквайринг',
  client_compensation: 'Компенсации',
  loyalty_points: 'Баллы/Кэшбэк',
  early_payment: 'Ранняя выплата',
  logistics: 'Логистика',
  storage: 'Хранение',
  other: 'Прочее'
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const formatPercent = (value) => {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

// Component for showing change indicator
const ChangeIndicator = ({ value, inverted = false }) => {
  if (value === undefined || value === null) return null
  
  // For expenses, positive change is bad (inverted)
  const isPositive = inverted ? value < 0 : value > 0
  const Icon = isPositive ? FiTrendingUp : FiTrendingDown
  const colorClass = isPositive ? 'text-green-500' : 'text-red-500'
  
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${colorClass}`}>
      <Icon size={14} />
      {formatPercent(value)}
    </span>
  )
}

// Main summary card component
const SummaryCard = ({ title, value, change, subtitle, icon: Icon, colorClass, inverted }) => (
  <div className="card-neon p-5" data-testid={`summary-card-${title.toLowerCase().replace(/\s/g, '-')}`}>
    <div className="flex items-start justify-between mb-2">
      <span className="text-mm-text-secondary text-sm font-mono uppercase">{title}</span>
      {Icon && <Icon className={colorClass || 'text-mm-cyan'} size={20} />}
    </div>
    <div className="text-2xl font-bold text-mm-text mb-1">{value}</div>
    <div className="flex items-center justify-between">
      <span className="text-mm-text-secondary text-xs">{subtitle}</span>
      <ChangeIndicator value={change} inverted={inverted} />
    </div>
  </div>
)

// Expense breakdown item
const ExpenseItem = ({ name, amount, total, color, expanded, onToggle }) => {
  const percentage = total > 0 ? (amount / total * 100).toFixed(1) : 0
  
  return (
    <div 
      className="border-b border-mm-border last:border-0 py-3 cursor-pointer hover:bg-mm-gray/30 px-2 -mx-2 rounded transition-colors"
      onClick={onToggle}
      data-testid={`expense-item-${name}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: color }}
          />
          <span className="text-mm-text font-mono">{name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-mm-text-secondary text-sm">{percentage}%</span>
          <span className="text-mm-text font-mono font-bold">{formatCurrency(amount)}</span>
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-2 h-1.5 bg-mm-gray rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{ 
            width: `${percentage}%`,
            backgroundColor: color
          }}
        />
      </div>
    </div>
  )
}

export default function BusinessEconomicsTab({ dateFrom, dateTo }) {
  const { api } = useAuth()
  const [activeMarketplace, setActiveMarketplace] = useState('ozon')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [data, setData] = useState(null)
  const [yandexData, setYandexData] = useState(null)
  const [compareEnabled, setCompareEnabled] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [detailedOperations, setDetailedOperations] = useState(null)
  const [showTaxSettings, setShowTaxSettings] = useState(false)
  const [taxSystems, setTaxSystems] = useState([])
  const [currentTaxSystem, setCurrentTaxSystem] = useState('usn_6')

  // Load tax systems on mount
  useEffect(() => {
    const loadTaxSystems = async () => {
      try {
        const response = await api.get('/api/business-analytics/tax-systems')
        setTaxSystems(response.data.systems || [])
        
        const settingsResponse = await api.get('/api/business-analytics/tax-settings')
        setCurrentTaxSystem(settingsResponse.data.current_system || 'usn_6')
      } catch (error) {
        console.error('Error loading tax systems:', error)
      }
    }
    loadTaxSystems()
  }, [])

  const updateTaxSystem = async (newSystem) => {
    try {
      await api.post(`/api/business-analytics/tax-settings?tax_system=${newSystem}`)
      setCurrentTaxSystem(newSystem)
      toast.success('Система налогообложения обновлена')
      // Reload data with new tax
      loadEconomics()
    } catch (error) {
      toast.error('Ошибка сохранения настроек')
    }
  }

  const loadEconomics = async () => {
    setLoading(true)
    try {
      // Load Ozon data
      const ozonResponse = await api.get('/api/business-analytics/economics', {
        params: {
          date_from: dateFrom,
          date_to: dateTo,
          compare_previous: compareEnabled
        }
      })
      setData(ozonResponse.data)
      
      // Try to load Yandex data
      try {
        const yandexResponse = await api.get('/api/yandex-analytics/economics', {
          params: {
            date_from: dateFrom,
            date_to: dateTo,
            compare_previous: compareEnabled
          }
        })
        setYandexData(yandexResponse.data)
      } catch (yErr) {
        console.log('Yandex data not available:', yErr.message)
        setYandexData(null)
      }
    } catch (error) {
      console.error('Error loading economics:', error)
      if (error.response?.status === 404) {
        toast.error('API ключи не найдены. Добавьте ключи в настройках интеграций.')
      } else {
        toast.error('Ошибка загрузки данных: ' + (error.response?.data?.detail || error.message))
      }
    }
    setLoading(false)
  }

  const syncOperations = async () => {
    setSyncing(true)
    try {
      const response = await api.post('/api/business-analytics/sync-operations', null, {
        params: {
          date_from: dateFrom,
          date_to: dateTo
        }
      })
      toast.success(`Синхронизировано: ${response.data.statistics.total_fetched} операций`)
      await loadEconomics()
    } catch (error) {
      toast.error('Ошибка синхронизации: ' + (error.response?.data?.detail || error.message))
    }
    setSyncing(false)
  }

  const loadDetailedOperations = async () => {
    try {
      const response = await api.get('/api/business-analytics/detailed-operations', {
        params: {
          date_from: dateFrom,
          date_to: dateTo
        }
      })
      setDetailedOperations(response.data)
    } catch (error) {
      console.error('Error loading detailed operations:', error)
    }
  }

  useEffect(() => {
    if (dateFrom && dateTo) {
      loadEconomics()
    }
  }, [dateFrom, dateTo, compareEnabled])

  // Prepare chart data
  const prepareExpenseChartData = () => {
    if (!data?.expense_breakdown) return []
    
    const expenses = Object.entries(data.expense_breakdown)
      .filter(([key, val]) => val.amount > 0)
      .map(([key, val]) => ({
        name: EXPENSE_LABELS[key] || val.name,
        value: val.amount,
        color: EXPENSE_COLORS[key] || EXPENSE_COLORS.other
      }))
    
    // Добавляем себестоимость (COGS) если есть
    if (data.summary?.cogs > 0) {
      expenses.push({
        name: 'Себестоимость',
        value: data.summary.cogs,
        color: EXPENSE_COLORS.cogs
      })
    }
    
    return expenses.sort((a, b) => b.value - a.value)
  }

  const expenseChartData = prepareExpenseChartData()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mm-cyan"></div>
        <span className="ml-4 text-mm-text-secondary">Загрузка данных из Ozon API...</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="card-neon p-8 text-center">
        <FiAlertTriangle className="mx-auto text-yellow-500 mb-4" size={48} />
        <h3 className="text-lg font-mono text-mm-text mb-2">Данные не загружены</h3>
        <p className="text-mm-text-secondary mb-4">
          Нажмите кнопку для загрузки данных из Ozon API
        </p>
        <button 
          onClick={loadEconomics}
          className="btn-primary"
          data-testid="load-economics-btn"
        >
          Загрузить данные
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="business-economics-tab">
      {/* Marketplace selector */}
      <div className="flex items-center gap-2 p-1 bg-mm-gray rounded-lg w-fit">
        <button
          onClick={() => setActiveMarketplace('ozon')}
          className={`px-4 py-2 rounded-md font-mono text-sm transition-all ${
            activeMarketplace === 'ozon' 
              ? 'bg-[#005bff] text-white' 
              : 'text-mm-text-secondary hover:text-mm-text'
          }`}
          data-testid="ozon-tab"
        >
          🟠 Ozon
        </button>
        <button
          onClick={() => setActiveMarketplace('yandex')}
          className={`px-4 py-2 rounded-md font-mono text-sm transition-all ${
            activeMarketplace === 'yandex' 
              ? 'bg-[#ffcc00] text-black' 
              : 'text-mm-text-secondary hover:text-mm-text'
          }`}
          data-testid="yandex-tab"
        >
          🔴 Яндекс.Маркет {yandexData ? '' : '(нет ключа)'}
        </button>
        <button
          disabled
          className="px-4 py-2 rounded-md font-mono text-sm text-mm-text-secondary/50 cursor-not-allowed"
        >
          🟣 WB (скоро)
        </button>
      </div>

      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-mono text-mm-cyan uppercase">
            ЭКОНОМИКА БИЗНЕСА — {MARKETPLACE_CONFIG[activeMarketplace]?.name || activeMarketplace}
          </h3>
          <p className="text-mm-text-secondary text-sm">
            Период: {dateFrom} — {dateTo} ({data.period?.days} дней) 
            {activeMarketplace === 'ozon' && ` • ${data.operations_count} операций`}
            {activeMarketplace === 'yandex' && yandexData && ` • ${yandexData.summary?.total_orders || 0} заказов`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-mm-text-secondary cursor-pointer">
            <input 
              type="checkbox" 
              checked={compareEnabled}
              onChange={(e) => setCompareEnabled(e.target.checked)}
              className="rounded border-mm-border bg-mm-gray"
            />
            Сравнить с прошлым периодом
          </label>
          <button 
            onClick={syncOperations}
            disabled={syncing || activeMarketplace !== 'ozon'}
            className="btn-secondary text-sm px-4 flex items-center gap-2"
            data-testid="sync-operations-btn"
          >
            <FiRefreshCw className={syncing ? 'animate-spin' : ''} size={16} />
            {syncing ? 'Синхронизация...' : 'Обновить'}
          </button>
        </div>
      </div>

      {/* YANDEX MARKET SECTION */}
      {activeMarketplace === 'yandex' && (
        <>
          {!yandexData ? (
            <div className="card-neon p-8 text-center">
              <FiAlertTriangle className="mx-auto text-yellow-500 mb-4" size={48} />
              <h3 className="text-lg font-mono text-mm-text mb-2">Яндекс.Маркет не подключен</h3>
              <p className="text-mm-text-secondary mb-4">
                Добавьте API ключ Яндекс.Маркета в настройках интеграций
              </p>
            </div>
          ) : (
            <>
              {/* Yandex Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SummaryCard
                  title="Выручка"
                  value={formatCurrency(yandexData.summary?.revenue || 0)}
                  change={yandexData.comparison?.changes?.revenue_change_pct}
                  subtitle="Доставленные заказы"
                  icon={FiDollarSign}
                  colorClass="text-green-500"
                />
                <SummaryCard
                  title="До скидки"
                  value={formatCurrency(yandexData.summary?.revenue_before_discount || 0)}
                  subtitle={`Скидка: ${formatCurrency(yandexData.summary?.discount_given || 0)}`}
                  icon={FiTrendingDown}
                  colorClass="text-orange-500"
                />
                <SummaryCard
                  title="Субсидии от ЯМ"
                  value={formatCurrency(yandexData.summary?.subsidies_from_yandex || 0)}
                  subtitle="Компенсации акций"
                  icon={FiTrendingUp}
                  colorClass="text-yellow-500"
                />
                <SummaryCard
                  title="Заказы"
                  value={yandexData.summary?.delivered_orders || 0}
                  change={yandexData.comparison?.changes?.orders_change_pct}
                  subtitle={`Всего: ${yandexData.summary?.total_orders || 0}, отменено: ${yandexData.summary?.cancelled_orders || 0}`}
                  icon={FiShoppingCart}
                  colorClass="text-blue-500"
                />
              </div>

              {/* Orders by status */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card-neon p-6">
                  <h4 className="text-mm-cyan font-mono uppercase mb-4 flex items-center gap-2">
                    <FiPackage size={16} />
                    ЗАКАЗЫ ПО СТАТУСАМ
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(yandexData.by_status || {}).map(([status, info]) => (
                      <div key={status} className="flex items-center justify-between p-3 bg-mm-gray/30 rounded">
                        <div className="flex items-center gap-3">
                          <span className={`w-2 h-2 rounded-full ${
                            status === 'DELIVERED' ? 'bg-green-500' :
                            status === 'PROCESSING' ? 'bg-blue-500' :
                            status === 'PICKUP' ? 'bg-yellow-500' :
                            status === 'CANCELLED' ? 'bg-red-500' : 'bg-gray-500'
                          }`}></span>
                          <span className="text-mm-text font-mono">
                            {status === 'DELIVERED' ? 'Доставлено' :
                             status === 'PROCESSING' ? 'В обработке' :
                             status === 'PICKUP' ? 'В пункте выдачи' :
                             status === 'CANCELLED' ? 'Отменено' : status}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-mm-text font-bold">{info.count} шт.</div>
                          <div className="text-mm-text-secondary text-sm">{formatCurrency(info.revenue)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card-neon p-6">
                  <h4 className="text-mm-cyan font-mono uppercase mb-4 flex items-center gap-2">
                    <FiMapPin size={16} />
                    ТОП РЕГИОНЫ
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(yandexData.top_regions || {}).map(([region, count]) => (
                      <div key={region} className="flex items-center justify-between py-2 border-b border-mm-border/50 last:border-0">
                        <span className="text-mm-text">{region}</span>
                        <span className="text-mm-cyan font-mono">{count} заказов</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Previous period comparison */}
              {yandexData.comparison && (
                <div className="card-neon p-6 bg-mm-gray/20">
                  <h4 className="text-mm-text-secondary font-mono uppercase mb-3">
                    Сравнение с периодом {yandexData.comparison.previous_period?.from} — {yandexData.comparison.previous_period?.to}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-mm-text-secondary text-sm">Выручка прошлого периода</div>
                      <div className="text-xl font-bold text-mm-text">{formatCurrency(yandexData.comparison.changes?.prev_revenue || 0)}</div>
                    </div>
                    <div>
                      <div className="text-mm-text-secondary text-sm">Заказов прошлого периода</div>
                      <div className="text-xl font-bold text-mm-text">{yandexData.comparison.changes?.prev_orders || 0}</div>
                    </div>
                    <div>
                      <div className="text-mm-text-secondary text-sm">Изменение выручки</div>
                      <div className={`text-xl font-bold ${yandexData.comparison.changes?.revenue_change_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatPercent(yandexData.comparison.changes?.revenue_change_pct || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-mm-text-secondary text-sm">Изменение заказов</div>
                      <div className={`text-xl font-bold ${yandexData.comparison.changes?.orders_change_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatPercent(yandexData.comparison.changes?.orders_change_pct || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* OZON SECTION - Only show when Ozon is active */}
      {activeMarketplace === 'ozon' && (
        <>
      {/* Tax settings panel */}
      <div className="card-neon p-4 bg-mm-gray/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-mm-text-secondary text-sm">Система налогообложения:</span>
            <select
              value={currentTaxSystem}
              onChange={(e) => updateTaxSystem(e.target.value)}
              className="bg-mm-gray border border-mm-border rounded px-3 py-1.5 text-mm-text text-sm"
            >
              {taxSystems.map(sys => (
                <option key={sys.code} value={sys.code}>{sys.name}</option>
              ))}
            </select>
          </div>
          {data?.tax_info && (
            <div className="text-sm">
              <span className="text-mm-text-secondary">Налог ({data.tax_info.name}): </span>
              <span className="text-orange-400 font-mono">{formatCurrency(data.tax_info.tax_amount || 0)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <SummaryCard
          title="Доходы"
          value={formatCurrency(data.summary?.gross_income || 0)}
          change={data.comparison?.changes?.income_change_pct}
          subtitle="Продажи + компенсации"
          icon={FiTrendingUp}
          colorClass="text-green-500"
        />
        <SummaryCard
          title="Расходы МП"
          value={formatCurrency(data.summary?.mp_expenses || data.summary?.total_expenses || 0)}
          change={data.comparison?.changes?.expenses_change_pct}
          subtitle="Комиссии, логистика..."
          icon={FiTrendingDown}
          colorClass="text-red-500"
          inverted={true}
        />
        {/* COGS - Себестоимость */}
        <div className="card-neon p-5 bg-purple-500/10 border-purple-500/30">
          <div className="flex items-start justify-between mb-2">
            <span className="text-mm-text-secondary text-sm font-mono uppercase">СЕБЕСТОИМОСТЬ</span>
          </div>
          <div className="text-2xl font-bold text-purple-400">{formatCurrency(data.summary?.cogs || 0)}</div>
          <div className="text-mm-text-secondary text-xs">
            {data.cogs_info ? `${data.cogs_info.items_with_cogs} из ${data.cogs_info.items_with_cogs + data.cogs_info.items_without_cogs} товаров` : 'COGS'}
          </div>
        </div>
        <div className="card-neon p-5 bg-orange-500/10 border-orange-500/30">
          <div className="flex items-start justify-between mb-2">
            <span className="text-mm-text-secondary text-sm font-mono uppercase">НАЛОГ</span>
          </div>
          <div className="text-2xl font-bold text-orange-400">{formatCurrency(data.summary?.tax_amount || 0)}</div>
          <div className="text-mm-text-secondary text-xs">{data.tax_info?.name || 'УСН 6%'}</div>
        </div>
        <SummaryCard
          title="Чистая прибыль"
          value={formatCurrency(data.summary?.net_profit || 0)}
          change={data.comparison?.changes?.profit_change_pct}
          subtitle={`После налогов • Маржа: ${data.summary?.margin_pct?.toFixed(1) || 0}%`}
          icon={FiDollarSign}
          colorClass={data.summary?.net_profit >= 0 ? 'text-green-500' : 'text-red-500'}
        />
        {data.comparison && (
          <div className="card-neon p-5 bg-mm-gray/30">
            <div className="text-mm-text-secondary text-sm font-mono uppercase mb-2">
              ПРОШЛЫЙ ПЕРИОД
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-mm-text-secondary">Доходы:</span>
                <span className="text-mm-text">{formatCurrency(data.comparison.changes?.prev_income || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mm-text-secondary">Расходы:</span>
                <span className="text-mm-text">{formatCurrency(data.comparison.changes?.prev_expenses || 0)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-mm-text-secondary">Прибыль:</span>
                <span className="text-mm-text">{formatCurrency(data.comparison.changes?.prev_profit || 0)}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-mm-border text-xs text-mm-text-secondary">
              {data.comparison.previous_period?.from} — {data.comparison.previous_period?.to}
            </div>
          </div>
        )}
      </div>

      {/* Income breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-neon p-5 bg-green-500/5 border-green-500/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-mm-text-secondary text-sm font-mono uppercase">Продажи</span>
          </div>
          <div className="text-xl font-bold text-green-500">
            {formatCurrency(data.income_breakdown?.sales || 0)}
          </div>
        </div>
        <div className="card-neon p-5 bg-blue-500/5 border-blue-500/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-mm-text-secondary text-sm font-mono uppercase">Компенсации</span>
          </div>
          <div className="text-xl font-bold text-blue-500">
            {formatCurrency(data.income_breakdown?.compensations || 0)}
          </div>
        </div>
        <div className="card-neon p-5 bg-gray-500/5 border-gray-500/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-gray-500"></div>
            <span className="text-mm-text-secondary text-sm font-mono uppercase">Прочие</span>
          </div>
          <div className="text-xl font-bold text-gray-400">
            {formatCurrency(data.income_breakdown?.other || 0)}
          </div>
        </div>
      </div>

      {/* Expenses breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="card-neon p-6">
          <h4 className="text-mm-cyan font-mono uppercase mb-4 flex items-center gap-2">
            <FiInfo size={16} />
            СТРУКТУРА РАСХОДОВ
          </h4>
          {expenseChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expenseChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {expenseChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: '#1a1a2e', 
                    border: '1px solid #3b3b5c',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-mm-text-secondary">
              Нет данных о расходах
            </div>
          )}
        </div>

        {/* Expense list */}
        <div className="card-neon p-6">
          <h4 className="text-mm-cyan font-mono uppercase mb-4">
            ДЕТАЛИЗАЦИЯ РАСХОДОВ
          </h4>
          <div className="space-y-1">
            {Object.entries(data.expense_breakdown || {})
              .filter(([key, val]) => val.amount > 0)
              .sort((a, b) => b[1].amount - a[1].amount)
              .map(([key, val]) => (
                <ExpenseItem
                  key={key}
                  name={EXPENSE_LABELS[key] || val.name}
                  amount={val.amount}
                  total={data.summary?.total_expenses || 0}
                  color={EXPENSE_COLORS[key] || EXPENSE_COLORS.other}
                />
              ))
            }
          </div>
          <div className="mt-4 pt-4 border-t border-mm-border flex justify-between items-center">
            <span className="text-mm-text-secondary font-mono">ИТОГО РАСХОДОВ:</span>
            <span className="text-xl font-bold text-red-500">
              {formatCurrency(data.summary?.total_expenses || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Detailed operations toggle */}
      <div className="card-neon p-4">
        <button
          onClick={() => {
            setShowDetails(!showDetails)
            if (!showDetails && !detailedOperations) {
              loadDetailedOperations()
            }
          }}
          className="w-full flex items-center justify-between text-mm-text-secondary hover:text-mm-cyan transition-colors"
          data-testid="toggle-details-btn"
        >
          <span className="font-mono uppercase">Детализация по типам операций</span>
          {showDetails ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
        </button>
        
        {showDetails && detailedOperations && (
          <div className="mt-4 pt-4 border-t border-mm-border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-mm-text-secondary text-left">
                    <th className="pb-2 font-mono">Тип операции</th>
                    <th className="pb-2 font-mono text-center">Кол-во</th>
                    <th className="pb-2 font-mono text-right">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedOperations.operation_types?.map((op, idx) => (
                    <tr key={idx} className="border-t border-mm-border/50">
                      <td className="py-2">
                        <div className="text-mm-text">{op.name || op.type}</div>
                        <div className="text-xs text-mm-text-secondary">{op.type}</div>
                      </td>
                      <td className="py-2 text-center text-mm-text-secondary">{op.count}</td>
                      <td className={`py-2 text-right font-mono ${op.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatCurrency(op.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Unit Economics по товарам */}
      <ProductsEconomicsSection dateFrom={dateFrom} dateTo={dateTo} api={api} />

        </>
      )}
    </div>
  )
}

// Компонент Unit Economics по товарам
function ProductsEconomicsSection({ dateFrom, dateTo, api }) {
  const [products, setProducts] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [selectedTag, setSelectedTag] = useState('')
  const [availableTags, setAvailableTags] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('profit_asc') // убыточные сверху
  const [exporting, setExporting] = useState(false)

  const loadProducts = async () => {
    if (!dateFrom || !dateTo) return
    setLoading(true)
    try {
      const params = { date_from: dateFrom, date_to: dateTo }
      if (selectedTag) params.tag = selectedTag
      
      const response = await api.get('/api/business-analytics/products-economics', { params })
      setProducts(response.data.products || [])
      setSummary(response.data.summary || null)
      setAvailableTags(response.data.available_tags || [])
    } catch (error) {
      toast.error('Ошибка загрузки unit economics')
      console.error(error)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (expanded && dateFrom && dateTo) {
      loadProducts()
    }
  }, [expanded, dateFrom, dateTo, selectedTag])

  // Фильтрация и сортировка
  const filteredProducts = React.useMemo(() => {
    let result = [...products]
    
    // Поиск
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(p => 
        p.name?.toLowerCase().includes(query) ||
        p.article?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query)
      )
    }
    
    // Сортировка
    switch (sortBy) {
      case 'profit_asc':
        result.sort((a, b) => a.profit - b.profit)
        break
      case 'profit_desc':
        result.sort((a, b) => b.profit - a.profit)
        break
      case 'revenue_desc':
        result.sort((a, b) => b.revenue - a.revenue)
        break
      case 'sales_desc':
        result.sort((a, b) => b.sales_count - a.sales_count)
        break
      case 'margin_asc':
        result.sort((a, b) => a.margin_pct - b.margin_pct)
        break
    }
    
    return result
  }, [products, searchQuery, sortBy])

  const exportToExcel = async () => {
    setExporting(true)
    try {
      const params = { date_from: dateFrom, date_to: dateTo }
      if (selectedTag) params.tag = selectedTag
      
      const response = await api.get('/api/business-analytics/products-economics/export', {
        params,
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `unit_economics_${dateFrom}_${dateTo}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Отчёт экспортирован')
    } catch (error) {
      toast.error('Ошибка экспорта')
    }
    setExporting(false)
  }

  return (
    <div className="card-neon overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-mm-text hover:bg-mm-gray/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FiPackage size={20} className="text-mm-cyan" />
          <span className="font-mono uppercase">UNIT ECONOMICS ПО ТОВАРАМ</span>
          {summary && (
            <span className="text-sm text-mm-text-secondary">
              ({summary.total_products} товаров: {summary.profitable} прибыльных, {summary.unprofitable} убыточных)
            </span>
          )}
        </div>
        {expanded ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
      </button>
      
      {expanded && (
        <div className="p-4 pt-0 border-t border-mm-border space-y-4">
          {/* Фильтры */}
          <div className="flex flex-wrap items-center gap-4 pt-4">
            <input
              type="text"
              placeholder="Поиск по названию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[200px] bg-mm-black border border-mm-border rounded px-3 py-2 text-sm focus:border-mm-cyan outline-none"
            />
            
            {availableTags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="bg-mm-black border border-mm-border rounded px-3 py-2 text-sm focus:border-mm-cyan outline-none"
              >
                <option value="">Все теги</option>
                {availableTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            )}
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-mm-black border border-mm-border rounded px-3 py-2 text-sm focus:border-mm-cyan outline-none"
            >
              <option value="profit_asc">Убыточные сначала</option>
              <option value="profit_desc">Прибыльные сначала</option>
              <option value="revenue_desc">По выручке ↓</option>
              <option value="sales_desc">По продажам ↓</option>
              <option value="margin_asc">Маржа ↑</option>
            </select>
            
            <button
              onClick={exportToExcel}
              disabled={exporting || loading}
              className="btn-secondary text-sm px-4"
            >
              {exporting ? 'Экспорт...' : '📥 Excel'}
            </button>
            
            <button
              onClick={loadProducts}
              disabled={loading}
              className="btn-secondary text-sm px-3"
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} size={16} />
            </button>
          </div>
          
          {/* Сводка */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="bg-mm-gray/30 rounded p-3 text-center">
                <div className="text-lg font-bold text-mm-cyan">{summary.total_products}</div>
                <div className="text-xs text-mm-text-secondary">Товаров</div>
              </div>
              <div className="bg-green-500/10 rounded p-3 text-center">
                <div className="text-lg font-bold text-green-400">{summary.profitable}</div>
                <div className="text-xs text-mm-text-secondary">Прибыльных</div>
              </div>
              <div className="bg-red-500/10 rounded p-3 text-center">
                <div className="text-lg font-bold text-red-400">{summary.unprofitable}</div>
                <div className="text-xs text-mm-text-secondary">Убыточных</div>
              </div>
              <div className="bg-yellow-500/10 rounded p-3 text-center">
                <div className="text-lg font-bold text-yellow-400">{summary.without_cogs}</div>
                <div className="text-xs text-mm-text-secondary">Без COGS</div>
              </div>
              <div className="bg-mm-gray/30 rounded p-3 text-center">
                <div className="text-lg font-bold text-mm-text">{formatCurrency(summary.total_revenue)}</div>
                <div className="text-xs text-mm-text-secondary">Выручка</div>
              </div>
              <div className={`rounded p-3 text-center ${summary.total_profit >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                <div className={`text-lg font-bold ${summary.total_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(summary.total_profit)}
                </div>
                <div className="text-xs text-mm-text-secondary">Прибыль</div>
              </div>
            </div>
          )}
          
          {/* Таблица товаров */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mm-cyan mx-auto"></div>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-mm-gray/80">
                  <tr className="text-mm-cyan">
                    <th className="text-left p-2 font-mono">Товар</th>
                    <th className="text-center p-2 font-mono">Прод.</th>
                    <th className="text-right p-2 font-mono">Закуп.</th>
                    <th className="text-right p-2 font-mono">Выручка</th>
                    <th className="text-right p-2 font-mono">Расх.МП</th>
                    <th className="text-right p-2 font-mono">COGS</th>
                    <th className="text-right p-2 font-mono">Налог</th>
                    <th className="text-right p-2 font-mono">Прибыль</th>
                    <th className="text-right p-2 font-mono">Маржа</th>
                    <th className="text-right p-2 font-mono">₽/шт</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p, idx) => (
                    <tr 
                      key={idx} 
                      className={`border-t border-mm-border/30 hover:bg-mm-gray/20 ${
                        p.profit < 0 ? 'bg-red-500/5' : p.profit > 0 ? 'bg-green-500/5' : ''
                      }`}
                    >
                      <td className="p-2">
                        <div className="max-w-[200px] truncate text-mm-text" title={p.name}>
                          {p.name}
                        </div>
                        <div className="text-mm-text-secondary text-[10px]">
                          {p.article || p.sku}
                          {p.tags?.length > 0 && (
                            <span className="ml-2 text-purple-400">[{p.tags.join(', ')}]</span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-center text-mm-text">{p.sales_count}</td>
                      <td className={`p-2 text-right font-mono ${p.has_purchase_price ? 'text-mm-text' : 'text-yellow-400'}`}>
                        {p.purchase_price > 0 ? formatCurrency(p.purchase_price) : '⚠️'}
                      </td>
                      <td className="p-2 text-right font-mono text-green-400">
                        {formatCurrency(p.revenue)}
                      </td>
                      <td className="p-2 text-right font-mono text-red-400">
                        {formatCurrency(p.mp_expenses)}
                      </td>
                      <td className="p-2 text-right font-mono text-purple-400">
                        {formatCurrency(p.cogs)}
                      </td>
                      <td className="p-2 text-right font-mono text-orange-400">
                        {formatCurrency(p.tax)}
                      </td>
                      <td className={`p-2 text-right font-mono font-bold ${p.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(p.profit)}
                      </td>
                      <td className={`p-2 text-right font-mono ${p.margin_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {p.margin_pct.toFixed(1)}%
                      </td>
                      <td className={`p-2 text-right font-mono ${p.profit_per_unit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(p.profit_per_unit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredProducts.length === 0 && (
                <div className="text-center py-8 text-mm-text-secondary">
                  {products.length === 0 ? 'Нет данных о продажах' : 'Нет товаров по фильтру'}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
