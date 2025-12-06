import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiUpload, FiFileText, FiTrendingUp, FiList, FiFilter } from 'react-icons/fi'
import { toast } from 'sonner'

// Утилиты для дат
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

const getToday = () => {
  return getDateString(new Date())
}

function AnalyticsReportsPage() {
  const { api } = useAuth()
  
  // Состояние
  const [activeReport, setActiveReport] = useState('profit')  // 'profit', 'sales', 'transactions'
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState(null)
  
  // Фильтры
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth())
  const [dateTo, setDateTo] = useState(getToday())
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  
  // Загрузка позаказного отчета
  const handleUploadOrderReport = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await api.post('/api/ozon-reports/upload-order-realization', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      toast.success(`Отчет загружен! Транзакций: ${response.data.statistics.transactions_parsed}`)
      
      // Автоматически загружаем данные
      loadReportData()
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error('Ошибка загрузки: ' + (error.response?.data?.detail || error.message))
    }
    
    setUploading(false)
    event.target.value = ''  // Сброс input
  }
  
  // Загрузка данных отчета
  const loadReportData = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/ozon-reports/calculate-profit', {
        params: {
          period_start: dateFrom,
          period_end: dateTo
        }
      })
      
      setReportData(response.data)
    } catch (error) {
      console.error('Load failed:', error)
      toast.error('Ошибка загрузки данных')
    }
    setLoading(false)
  }
  
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) amount = 0
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2
    }).format(amount)
  }
  
  const formatPercent = (value) => {
    if (!value && value !== 0) value = 0
    return `${value.toFixed(2)}%`
  }
  
  return (
    <div className="space-y-6 pb-8">
      {/* Заголовок */}
      <div>
        <h2 className="text-2xl mb-2 text-mm-cyan uppercase">АНАЛИТИКА И ОТЧЁТЫ</h2>
        <p className="comment">// Анализ прибыли на основе документов Ozon</p>
      </div>

      {/* Dropdown меню отчетов */}
      <div className="card-neon p-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveReport('profit')}
            className={`px-6 py-3 rounded font-mono text-sm transition-all ${
              activeReport === 'profit'
                ? 'bg-mm-cyan text-mm-black'
                : 'bg-mm-gray text-mm-text-secondary hover:bg-mm-border'
            }`}
          >
            <FiTrendingUp className="inline mr-2" />
            ЧИСТАЯ ПРИБЫЛЬ
          </button>
          
          <button
            onClick={() => setActiveReport('sales')}
            className={`px-6 py-3 rounded font-mono text-sm transition-all ${
              activeReport === 'sales'
                ? 'bg-mm-cyan text-mm-black'
                : 'bg-mm-gray text-mm-text-secondary hover:bg-mm-border'
            }`}
          >
            <FiFileText className="inline mr-2" />
            ОБЩИЕ ПРОДАЖИ
          </button>
          
          <button
            onClick={() => setActiveReport('transactions')}
            className={`px-6 py-3 rounded font-mono text-sm transition-all ${
              activeReport === 'transactions'
                ? 'bg-mm-cyan text-mm-black'
                : 'bg-mm-gray text-mm-text-secondary hover:bg-mm-border'
            }`}
          >
            <FiList className="inline mr-2" />
            ТРАНЗАКЦИИ
          </button>
        </div>

        {/* Панель фильтров */}
        <div className="border-t border-mm-border pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-mm-text-secondary mb-2 font-mono">
                ПЕРИОД С:
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 bg-mm-black border border-mm-border rounded font-mono text-sm text-mm-text focus:border-mm-cyan focus:outline-none transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-sm text-mm-text-secondary mb-2 font-mono">
                ПО:
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 bg-mm-black border border-mm-border rounded font-mono text-sm text-mm-text focus:border-mm-cyan focus:outline-none transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-sm text-mm-text-secondary mb-2 font-mono">
                ТЕГ ТОВАРА:
              </label>
              <input
                type="text"
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                placeholder="Например: MINIMALMOD"
                className="w-full px-4 py-2 bg-mm-black border border-mm-border rounded font-mono text-sm text-mm-text focus:border-mm-cyan focus:outline-none transition-colors placeholder:text-mm-text-tertiary"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={loadReportData}
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'ЗАГРУЗКА...' : 'ПОКАЗАТЬ'}
              </button>
            </div>
          </div>
          
          {/* Кнопка загрузки отчета */}
          <div className="mt-4 pt-4 border-t border-mm-border">
            <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer">
              <FiUpload />
              {uploading ? 'ЗАГРУЗКА ФАЙЛА...' : 'ЗАГРУЗИТЬ ПОЗАКАЗНЫЙ ОТЧЕТ'}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleUploadOrderReport}
                disabled={uploading}
                className="hidden"
              />
            </label>
            <p className="text-xs text-mm-text-tertiary mt-2 font-mono">
              // Загрузите файл "Позаказный отчет о реализации" из личного кабинета Ozon
            </p>
          </div>
        </div>
      </div>

      {/* Отображение отчета в зависимости от выбранного типа */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// ЗАГРУЗКА...</p>
        </div>
      ) : !reportData ? (
        <div className="card-neon text-center py-12">
          <p className="text-mm-text-secondary mb-2">Загрузите позаказный отчет и выберите период</p>
          <p className="comment">// Нажмите кнопку выше для загрузки файла из Ozon</p>
        </div>
      ) : activeReport === 'profit' ? (
        <ProfitReportView data={reportData} formatCurrency={formatCurrency} formatPercent={formatPercent} />
      ) : activeReport === 'sales' ? (
        <SalesReportView data={reportData} formatCurrency={formatCurrency} />
      ) : (
        <TransactionsReportView data={reportData} formatCurrency={formatCurrency} />
      )}
    </div>
  )
}

// Компонент отчета "Чистая прибыль"
function ProfitReportView({ data, formatCurrency, formatPercent }) {
  return (
    <div className="space-y-6">
      {/* Карточки метрик */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-neon p-6">
          <div className="text-sm text-mm-text-secondary font-mono mb-2">ВЫРУЧКА</div>
          <div className="text-3xl font-mono text-mm-cyan mb-2">
            {formatCurrency(data.revenue?.gross_revenue)}
          </div>
          <div className="text-xs text-mm-text-tertiary font-mono">
            Реализовано: {formatCurrency(data.revenue?.realized)}
          </div>
        </div>
        
        <div className="card-neon p-6">
          <div className="text-sm text-mm-text-secondary font-mono mb-2">РАСХОДЫ</div>
          <div className="text-3xl font-mono text-mm-red mb-2">
            {formatCurrency(data.expenses?.total)}
          </div>
          <div className="text-xs text-mm-text-tertiary font-mono">
            Комиссия Ozon
          </div>
        </div>
        
        <div className="card-neon p-6">
          <div className="text-sm text-mm-text-secondary font-mono mb-2">ЧИСТАЯ ПРИБЫЛЬ</div>
          <div className="text-3xl font-mono text-mm-green mb-2">
            {formatCurrency(data.profit?.net_profit)}
          </div>
          <div className="text-xs text-mm-text-tertiary font-mono">
            Маржа: {formatPercent(data.profit?.net_margin_pct)}
          </div>
        </div>
      </div>
      
      {/* Детальный отчет */}
      <div className="card-neon p-6">
        <h3 className="text-lg font-mono text-mm-cyan uppercase mb-4">ДЕТАЛИЗАЦИЯ</h3>
        
        <div className="space-y-4 font-mono text-sm">
          <div className="flex justify-between py-2 border-b border-mm-border">
            <span className="text-mm-text-secondary">Реализовано</span>
            <span>{formatCurrency(data.revenue?.realized)}</span>
          </div>
          
          <div className="flex justify-between py-2 border-b border-mm-border">
            <span className="text-mm-text-secondary">+ Выплаты по лояльности</span>
            <span className="text-mm-cyan">+{formatCurrency(data.revenue?.loyalty_payments)}</span>
          </div>
          
          <div className="flex justify-between py-2 border-b border-mm-border">
            <span className="text-mm-text-secondary">+ Баллы за скидки</span>
            <span className="text-mm-cyan">+{formatCurrency(data.revenue?.discount_points)}</span>
          </div>
          
          <div className="flex justify-between py-2 border-b border-mm-border font-bold">
            <span className="text-mm-cyan">= ВАЛОВАЯ ВЫРУЧКА</span>
            <span className="text-mm-cyan">{formatCurrency(data.revenue?.gross_revenue)}</span>
          </div>
          
          <div className="flex justify-between py-2 border-b border-mm-border">
            <span className="text-mm-text-secondary">- Базовая комиссия Ozon</span>
            <span className="text-mm-red">-{formatCurrency(data.expenses?.ozon_base_commission)}</span>
          </div>
          
          <div className="flex justify-between py-2 border-t-2 border-mm-cyan font-bold text-lg">
            <span className="text-mm-green">= ЧИСТАЯ ПРИБЫЛЬ</span>
            <span className="text-mm-green">{formatCurrency(data.profit?.net_profit)}</span>
          </div>
          
          <div className="flex justify-between py-2">
            <span className="text-mm-text-secondary">Маржа</span>
            <span>{formatPercent(data.profit?.net_margin_pct)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Компонент отчета "Общие продажи"
function SalesReportView({ data, formatCurrency }) {
  return (
    <div className="card-neon p-6">
      <h3 className="text-lg font-mono text-mm-cyan uppercase mb-4">ОБЩИЕ ПРОДАЖИ</h3>
      <p className="text-mm-text-secondary">Статистика продаж за период</p>
      <div className="mt-4 text-2xl font-mono text-mm-cyan">
        {formatCurrency(data.revenue?.realized)}
      </div>
      <p className="text-sm text-mm-text-tertiary mt-2">
        Транзакций: {data.statistics?.total_transactions || 0}
      </p>
    </div>
  )
}

// Компонент отчета "Транзакции"
function TransactionsReportView({ data, formatCurrency }) {
  return (
    <div className="card-neon p-6">
      <h3 className="text-lg font-mono text-mm-cyan uppercase mb-4">СПИСОК ТРАНЗАКЦИЙ</h3>
      <p className="text-mm-text-secondary">Детализация операций</p>
      <p className="text-sm text-mm-text-tertiary mt-2">
        Всего операций: {data.statistics?.total_transactions || 0}
      </p>
    </div>
  )
}

export default AnalyticsReportsPage
