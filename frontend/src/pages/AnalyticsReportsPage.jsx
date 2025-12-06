import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiUpload, FiFileText, FiTrendingUp, FiList, FiDownload, FiChevronDown, FiChevronUp } from 'react-icons/fi'
import { toast } from 'sonner'

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

function AnalyticsReportsPage() {
  const { api } = useAuth()
  const [activeReport, setActiveReport] = useState('profit')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [profitData, setProfitData] = useState(null)
  const [salesData, setSalesData] = useState(null)
  const [transactionsData, setTransactionsData] = useState(null)
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth())
  const [dateTo, setDateTo] = useState(getToday())
  const [tagFilter, setTagFilter] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)
  
  // Для управления расходами
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenses, setExpenses] = useState([])
  const [newExpense, setNewExpense] = useState({
    expense_date: getToday(),
    expense_type: 'УПД услуги',
    amount: '',
    description: '',
    document_number: ''
  })
  
  // Для налоговых настроек
  const [showTaxSettings, setShowTaxSettings] = useState(false)
  const [taxSettings, setTaxSettings] = useState({
    tax_system: null,
    rate: 0
  })
  
  // Для истории отчетов
  const [showReportsHistory, setShowReportsHistory] = useState(false)
  const [reportsHistory, setReportsHistory] = useState([])
  
  // Для фильтра по товару
  const [productFilter, setProductFilter] = useState('')
  const [productsList, setProductsList] = useState([])
  const [showProductsDropdown, setShowProductsDropdown] = useState(false)
  
  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await api.post('/api/ozon-reports/upload-order-realization', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toast.success(`Загружено ${response.data.statistics.transactions_parsed} транзакций`)
      loadData()
    } catch (error) {
      toast.error('Ошибка: ' + (error.response?.data?.detail || error.message))
    }
    setUploading(false)
    e.target.value = ''
  }
  
  const handleUploadOther = async (e, reportType) => {
    const file = e.target.files[0]
    if (!file) return
    
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      let endpoint = ''
      let successMessage = ''
      
      switch(reportType) {
        case 'loyalty':
          endpoint = '/api/ozon-reports/upload-loyalty-report'
          successMessage = 'Отчет по лояльности загружен'
          break
        case 'acquiring':
          endpoint = '/api/ozon-reports/upload-acquiring-report'
          successMessage = 'Отчет по эквайрингу загружен'
          break
        case 'rfbs':
          endpoint = '/api/ozon-reports/upload-rfbs-logistics'
          successMessage = 'Отчет по логистике rFBS загружен'
          break
        default:
          throw new Error('Неизвестный тип отчета')
      }
      
      const response = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toast.success(successMessage)
      loadData()
    } catch (error) {
      toast.error('Ошибка: ' + (error.response?.data?.detail || error.message))
    }
    setUploading(false)
    e.target.value = ''
  }

  
  const loadData = async () => {
    setLoading(true)
    try {
      const params = { period_start: dateFrom, period_end: dateTo }
      if (tagFilter) params.tag_filter = tagFilter
      
      if (activeReport === 'profit') {
        const r = await api.get('/api/ozon-reports/calculate-profit', { params })
        setProfitData(r.data)
      } else if (activeReport === 'sales') {
        const r = await api.get('/api/ozon-reports/sales-report', { params })
        setSalesData(r.data)
      } else {
        const r = await api.get('/api/ozon-reports/transactions-list', { params: {...params, limit: 100, offset: 0} })
        setTransactionsData(r.data)
      }
    } catch (error) {
      toast.error('Ошибка загрузки')
    }
    setLoading(false)
  }

  
  const loadExpenses = async () => {
    try {
      const r = await api.get('/api/ozon-reports/expenses', {
        params: { period_start: dateFrom, period_end: dateTo }
      })
      setExpenses(r.data.expenses || [])
    } catch (error) {
      console.error('Ошибка загрузки расходов', error)
    }
  }
  
  const addExpense = async () => {
    if (!newExpense.amount || parseFloat(newExpense.amount) <= 0) {
      toast.error('Введите сумму')
      return
    }
    
    try {
      await api.post('/api/ozon-reports/add-expense', newExpense)
      toast.success('Расход добавлен')
      setNewExpense({
        expense_date: getToday(),
        expense_type: 'УПД услуги',
        amount: '',
        description: '',
        document_number: ''
      })
      setShowExpenseForm(false)
      await loadExpenses()
      await loadData()
    } catch (error) {
      toast.error('Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }
  
  const deleteExpense = async (id) => {
    if (!confirm('Удалить расход?')) return
    
    try {
      await api.delete(`/api/ozon-reports/expense/${id}`)
      toast.success('Расход удален')
      await loadExpenses()
      await loadData()
    } catch (error) {
      toast.error('Ошибка удаления')
    }
  }

  
  // Функции для налоговых настроек
  const loadTaxSettings = async () => {
    try {
      const r = await api.get('/api/ozon-reports/tax-settings')
      setTaxSettings(r.data)
    } catch (error) {
      console.error('Ошибка загрузки налоговых настроек', error)
    }
  }
  
  const saveTaxSettings = async (system) => {
    try {
      await api.post('/api/ozon-reports/tax-settings', {
        tax_system: system
      })
      toast.success('Настройки сохранены')
      await loadTaxSettings()
      await loadData()
      setShowTaxSettings(false)
    } catch (error) {
      toast.error('Ошибка сохранения')
    }
  }
  
  // Функции для истории отчетов
  const loadReportsHistory = async () => {
    try {
      const r = await api.get('/api/ozon-reports/reports-history')
      setReportsHistory(r.data.reports || [])
    } catch (error) {
      console.error('Ошибка загрузки истории', error)
    }
  }
  
  const deleteReport = async (id) => {
    if (!confirm('Удалить отчет и все связанные транзакции?')) return
    
    try {
      const r = await api.delete(`/api/ozon-reports/report/${id}`)
      toast.success(`Удалено транзакций: ${r.data.deleted_transactions}`)
      await loadReportsHistory()
      await loadData()
    } catch (error) {
      toast.error('Ошибка удаления')
    }

  
  // Функции для фильтра по товару
  const loadProductsList = async () => {
    try {
      const r = await api.get('/api/ozon-reports/products-list')
      setProductsList(r.data.products || [])
    } catch (error) {
      console.error('Ошибка загрузки товаров', error)
    }
  }

  }


  
  const exportExcel = async () => {
    try {
      const params = { period_start: dateFrom, period_end: dateTo }
      if (tagFilter) params.tag_filter = tagFilter
      
      const response = await api.get('/api/ozon-reports/export-excel', {
        params,
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `ozon_report_${dateFrom}_${dateTo}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Экспорт завершен!')
    } catch (error) {
      toast.error('Ошибка экспорта')
    }
  }
  
  useEffect(() => {
    loadTaxSettings()
    loadReportsHistory()
  }, [])
  
  useEffect(() => {
    if (profitData || salesData || transactionsData) {
      loadData()
      loadExpenses()
    }
  }, [activeReport])
  
  const fmt = (n) => {
    if (!n && n !== 0) n = 0
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(n)
  }
  
  const pct = (n) => `${(n || 0).toFixed(2)}%`
  
  return (
    <div className="space-y-6 pb-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl mb-2 text-mm-cyan uppercase">АНАЛИТИКА И ОТЧЁТЫ</h2>
          <p className="comment">// Анализ на основе документов Ozon</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowTaxSettings(!showTaxSettings)}
            className="btn-secondary text-sm px-4"
          >
            ⚙️ НАЛОГИ
          </button>
          <button 
            onClick={() => setShowReportsHistory(!showReportsHistory)}
            className="btn-secondary text-sm px-4"
          >
            📚 ИСТОРИЯ
          </button>
        </div>
      </div>

      {/* МОДАЛЬНОЕ ОКНО НАЛОГОВЫХ НАСТРОЕК */}
      {showTaxSettings && (
        <div className="card-neon p-6 bg-mm-gray bg-opacity-30">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-mono text-mm-cyan uppercase">НАСТРОЙКА НАЛОГООБЛОЖЕНИЯ</h3>
            <button onClick={() => setShowTaxSettings(false)} className="text-mm-text-secondary hover:text-mm-cyan">
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <button 
              onClick={() => saveTaxSettings('usn_income')}
              className={`p-4 rounded border-2 transition-colors ${
                taxSettings?.tax_system === 'usn_income' 
                  ? 'border-mm-cyan bg-mm-cyan bg-opacity-10' 
                  : 'border-mm-border hover:border-mm-cyan'
              }`}
            >
              <div className="font-mono text-lg text-mm-cyan">УСН Доходы</div>
              <div className="text-sm text-mm-text-secondary mt-1">6% от выручки</div>
            </button>
            
            <button 
              onClick={() => saveTaxSettings('usn_income_expense')}
              className={`p-4 rounded border-2 transition-colors ${
                taxSettings?.tax_system === 'usn_income_expense' 
                  ? 'border-mm-cyan bg-mm-cyan bg-opacity-10' 
                  : 'border-mm-border hover:border-mm-cyan'
              }`}
            >
              <div className="font-mono text-lg text-mm-cyan">УСН Доходы-Расходы</div>
              <div className="text-sm text-mm-text-secondary mt-1">15% от прибыли</div>
            </button>
            
            <button 
              onClick={() => saveTaxSettings('osn')}
              className={`p-4 rounded border-2 transition-colors ${
                taxSettings?.tax_system === 'osn' 
                  ? 'border-mm-cyan bg-mm-cyan bg-opacity-10' 
                  : 'border-mm-border hover:border-mm-cyan'
              }`}
            >
              <div className="font-mono text-lg text-mm-cyan">ОСН</div>
              <div className="text-sm text-mm-text-secondary mt-1">20% налог на прибыль</div>
            </button>
            
            <button 
              onClick={() => saveTaxSettings('patent')}
              className={`p-4 rounded border-2 transition-colors ${
                taxSettings?.tax_system === 'patent' 
                  ? 'border-mm-cyan bg-mm-cyan bg-opacity-10' 
                  : 'border-mm-border hover:border-mm-cyan'
              }`}
            >
              <div className="font-mono text-lg text-mm-cyan">Патент</div>
              <div className="text-sm text-mm-text-secondary mt-1">6% фиксированный</div>
            </button>
            
            <button 
              onClick={() => saveTaxSettings('eshn')}
              className={`p-4 rounded border-2 transition-colors ${
                taxSettings?.tax_system === 'eshn' 
                  ? 'border-mm-cyan bg-mm-cyan bg-opacity-10' 
                  : 'border-mm-border hover:border-mm-cyan'
              }`}
            >
              <div className="font-mono text-lg text-mm-cyan">ЕСХН</div>
              <div className="text-sm text-mm-text-secondary mt-1">6% для с/х</div>
            </button>
            
            <button 
              onClick={() => { setTaxSettings({ tax_system: null, rate: 0 }); saveTaxSettings(null); }}
              className={`p-4 rounded border-2 transition-colors ${
                !taxSettings?.tax_system 
                  ? 'border-mm-cyan bg-mm-cyan bg-opacity-10' 
                  : 'border-mm-border hover:border-mm-cyan'
              }`}
            >
              <div className="font-mono text-lg text-mm-text-secondary">Без налога</div>
              <div className="text-sm text-mm-text-tertiary mt-1">Не учитывать</div>
            </button>
          </div>
          
          {taxSettings?.tax_system && (
            <div className="mt-4 p-3 bg-mm-black rounded border border-mm-border">
              <div className="text-sm font-mono text-mm-cyan">
                Текущая система: {taxSettings.tax_system === 'usn_income' ? 'УСН Доходы 6%' :
                                  taxSettings.tax_system === 'usn_income_expense' ? 'УСН Доходы-Расходы 15%' :
                                  taxSettings.tax_system === 'osn' ? 'ОСН 20%' :
                                  taxSettings.tax_system === 'patent' ? 'Патент 6%' :
                                  taxSettings.tax_system === 'eshn' ? 'ЕСХН 6%' : 'Не установлена'}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* МОДАЛЬНОЕ ОКНО ИСТОРИИ ОТЧЕТОВ */}
      {showReportsHistory && (
        <div className="card-neon p-6 bg-mm-gray bg-opacity-30">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-mono text-mm-cyan uppercase">ИСТОРИЯ ЗАГРУЖЕННЫХ ОТЧЕТОВ</h3>
            <button onClick={() => setShowReportsHistory(false)} className="text-mm-text-secondary hover:text-mm-cyan">
              ✕
            </button>
          </div>
          
          {reportsHistory.length === 0 ? (
            <div className="text-center py-8 text-mm-text-secondary">
              Нет загруженных отчетов
            </div>
          ) : (
            <div className="space-y-2">
              {reportsHistory.map(report => (
                <div key={report._id} className="flex justify-between items-center bg-mm-black p-4 rounded border border-mm-border">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-mm-cyan">
                        {new Date(report.uploaded_at).toLocaleString('ru-RU')}
                      </span>
                      <span className="text-xs bg-mm-border px-2 py-1 rounded">
                        {report.report_type === 'order_realization' ? 'Позаказный отчет' : report.report_type}
                      </span>
                    </div>
                    <div className="text-sm text-mm-text mt-1">{report.file_name}</div>
                    <div className="text-xs text-mm-text-tertiary mt-1">
                      Транзакций: {report.summary?.total_transactions || 0} | 
                      Выручка: {fmt(report.summary?.total_revenue || 0)}
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteReport(report._id)}
                    className="text-mm-red hover:text-mm-text text-sm ml-4"
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card-neon p-6">
        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveReport('profit')} className={`px-6 py-3 rounded font-mono text-sm ${
              activeReport === 'profit' ? 'bg-mm-cyan text-mm-black' : 'bg-mm-gray text-mm-text-secondary hover:bg-mm-border'
            }`}>
            <FiTrendingUp className="inline mr-2" />ЧИСТАЯ ПРИБЫЛЬ
          </button>
          <button onClick={() => setActiveReport('sales')} className={`px-6 py-3 rounded font-mono text-sm ${
              activeReport === 'sales' ? 'bg-mm-cyan text-mm-black' : 'bg-mm-gray text-mm-text-secondary hover:bg-mm-border'
            }`}>
            <FiFileText className="inline mr-2" />ОБЩИЕ ПРОДАЖИ
          </button>
          <button onClick={() => setActiveReport('transactions')} className={`px-6 py-3 rounded font-mono text-sm ${
              activeReport === 'transactions' ? 'bg-mm-cyan text-mm-black' : 'bg-mm-gray text-mm-text-secondary hover:bg-mm-border'
            }`}>
            <FiList className="inline mr-2" />ТРАНЗАКЦИИ
          </button>
        </div>

        <div className="border-t border-mm-border pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-mm-text-secondary mb-2 font-mono">ПЕРИОД С:</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 bg-mm-black border border-mm-border rounded font-mono text-sm text-mm-text focus:border-mm-cyan focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm text-mm-text-secondary mb-2 font-mono">ПО:</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 bg-mm-black border border-mm-border rounded font-mono text-sm text-mm-text focus:border-mm-cyan focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm text-mm-text-secondary mb-2 font-mono">ТЕГ ТОВАРА:</label>
              <input type="text" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} placeholder="MINIMALMOD, crucial..."
                className="w-full px-4 py-2 bg-mm-black border border-mm-border rounded font-mono text-sm text-mm-text focus:border-mm-cyan focus:outline-none placeholder:text-mm-text-tertiary" />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={loadData} disabled={loading} className="btn-primary flex-1">
                {loading ? 'ЗАГРУЗКА...' : 'ПОКАЗАТЬ'}
              </button>
              <button onClick={exportExcel} className="btn-secondary px-4">
                <FiDownload />
              </button>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-mm-border space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer justify-center">
                <FiUpload />
                {uploading ? 'ЗАГРУЗКА...' : 'ПОЗАКАЗНЫЙ ОТЧЕТ'}
                <input type="file" accept=".xlsx,.xls" onChange={handleUpload} disabled={uploading} className="hidden" />
              </label>
              
              <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer justify-center">
                <FiUpload />
                ОТЧЕТ ПО ЛОЯЛЬНОСТИ
                <input type="file" accept=".xlsx,.xls" onChange={(e) => handleUploadOther(e, 'loyalty')} disabled={uploading} className="hidden" />
              </label>
              
              <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer justify-center">
                <FiUpload />
                ЭКВАЙРИНГ
                <input type="file" accept=".xlsx,.xls" onChange={(e) => handleUploadOther(e, 'acquiring')} disabled={uploading} className="hidden" />
              </label>
              
              <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer justify-center">
                <FiUpload />
                ЛОГИСТИКА rFBS
                <input type="file" accept=".xlsx,.xls" onChange={(e) => handleUploadOther(e, 'rfbs')} disabled={uploading} className="hidden" />
              </label>
            </div>
            <p className="text-xs text-mm-text-tertiary font-mono">
              {`// Загрузите файлы из личного кабинета Ozon (Финансы → Документы)`}
            </p>
          </div>
          
          {/* УПРАВЛЕНИЕ РУЧНЫМИ РАСХОДАМИ */}
          <div className="mt-4 pt-4 border-t border-mm-border">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-mono text-mm-cyan uppercase">РУЧНЫЕ РАСХОДЫ</h3>
              <button 
                onClick={() => setShowExpenseForm(!showExpenseForm)}
                className="btn-secondary text-xs px-3 py-1"
              >
                {showExpenseForm ? 'ОТМЕНА' : '+ ДОБАВИТЬ'}
              </button>
            </div>
            
            {showExpenseForm && (
              <div className="bg-mm-gray bg-opacity-10 p-4 rounded border border-mm-border mb-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-mm-text-secondary mb-1 font-mono">ДАТА</label>
                    <input 
                      type="date" 
                      value={newExpense.expense_date}
                      onChange={(e) => setNewExpense({...newExpense, expense_date: e.target.value})}
                      className="w-full px-3 py-2 bg-mm-black border border-mm-border rounded font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-mm-text-secondary mb-1 font-mono">ТИП РАСХОДА</label>
                    <select 
                      value={newExpense.expense_type}
                      onChange={(e) => setNewExpense({...newExpense, expense_type: e.target.value})}
                      className="w-full px-3 py-2 bg-mm-black border border-mm-border rounded font-mono text-sm"
                    >
                      <option>УПД услуги</option>
                      <option>Агентские комиссии</option>
                      <option>Продвижение</option>
                      <option>Реклама</option>
                      <option>Штрафы</option>
                      <option>Прочее</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-mm-text-secondary mb-1 font-mono">СУММА (₽)</label>
                    <input 
                      type="number" 
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-mm-black border border-mm-border rounded font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-mm-text-secondary mb-1 font-mono">№ ДОКУМЕНТА</label>
                    <input 
                      type="text" 
                      value={newExpense.document_number}
                      onChange={(e) => setNewExpense({...newExpense, document_number: e.target.value})}
                      placeholder="Необязательно"
                      className="w-full px-3 py-2 bg-mm-black border border-mm-border rounded font-mono text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-mm-text-secondary mb-1 font-mono">ОПИСАНИЕ</label>
                    <input 
                      type="text" 
                      value={newExpense.description}
                      onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                      placeholder="Необязательно"
                      className="w-full px-3 py-2 bg-mm-black border border-mm-border rounded font-mono text-sm"
                    />
                  </div>
                </div>
                <button onClick={addExpense} className="btn-primary mt-3">
                  СОХРАНИТЬ РАСХОД
                </button>
              </div>
            )}
            
            {expenses.length > 0 && (
              <div className="space-y-2">
                {expenses.map(exp => (
                  <div key={exp._id} className="flex justify-between items-center bg-mm-gray bg-opacity-10 p-3 rounded border border-mm-border">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-mm-cyan">{new Date(exp.expense_date).toLocaleDateString('ru-RU')}</span>
                        <span className="text-xs bg-mm-border px-2 py-1 rounded">{exp.expense_type}</span>
                        <span className="text-sm font-mono text-mm-text">{fmt(exp.amount)}</span>
                      </div>
                      {exp.description && (
                        <div className="text-xs text-mm-text-secondary mt-1">{exp.description}</div>
                      )}
                      {exp.document_number && (
                        <div className="text-xs text-mm-text-tertiary mt-1">№ {exp.document_number}</div>
                      )}
                    </div>
                    <button 
                      onClick={() => deleteExpense(exp._id)}
                      className="text-mm-red hover:text-mm-text text-sm"
                    >
                      Удалить
                    </button>
                  </div>
                ))}
                <div className="text-right text-sm font-mono text-mm-cyan pt-2 border-t border-mm-border">
                  Итого: {fmt(expenses.reduce((sum, e) => sum + e.amount, 0))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><p className="text-mm-cyan animate-pulse">// ЗАГРУЗКА...</p></div>
      ) : activeReport === 'profit' && profitData ? (
        <ProfitView data={profitData} fmt={fmt} pct={pct} />
      ) : activeReport === 'sales' && salesData ? (
        <SalesView data={salesData} fmt={fmt} />
      ) : activeReport === 'transactions' && transactionsData ? (
        <TransactionsView data={transactionsData} fmt={fmt} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
      ) : (
        <div className="card-neon text-center py-12">
          <p className="text-mm-text-secondary">Загрузите отчет и нажмите &quot;ПОКАЗАТЬ&quot;</p>
        </div>
      )}
    </div>
  )
}

function ProfitView({ data, fmt, pct }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card-neon p-6">
          <div className="text-sm text-mm-text-secondary font-mono mb-2">ЧИСТАЯ ВЫРУЧКА</div>
          <div className="text-3xl font-mono text-mm-cyan mb-2">{fmt(data.revenue?.net_revenue)}</div>
          <div className="text-xs text-mm-text-tertiary font-mono">
            {data.revenue?.returns?.total_returned > 0 
              ? `Возвраты: ${data.revenue?.returns?.returned_quantity} шт.`
              : `Валовая: ${fmt(data.revenue?.gross_revenue)}`
            }
          </div>
        </div>
        <div className="card-neon p-6">
          <div className="text-sm text-mm-text-secondary font-mono mb-2">СЕБЕСТОИМОСТЬ</div>
          <div className="text-3xl font-mono text-mm-red mb-2">{fmt(data.cogs?.total)}</div>
          <div className="text-xs text-mm-text-tertiary font-mono">
            {data.statistics?.cogs_coverage ? 
              `Покрытие: ${data.statistics.cogs_coverage.coverage_pct}%` : 
              `${pct(data.cogs?.percentage)}`
            }
          </div>
        </div>
        <div className="card-neon p-6">
          <div className="text-sm text-mm-text-secondary font-mono mb-2">РАСХОДЫ</div>
          <div className="text-3xl font-mono text-mm-red mb-2">{fmt(data.expenses?.total)}</div>
          <div className="text-xs text-mm-text-tertiary font-mono">Комиссия Ozon</div>
        </div>
        <div className="card-neon p-6">
          <div className="text-sm text-mm-text-secondary font-mono mb-2">ЧИСТАЯ ПРИБЫЛЬ</div>
          <div className="text-3xl font-mono text-mm-green mb-2">{fmt(data.profit?.net_profit)}</div>
          <div className="text-xs text-mm-text-tertiary font-mono">Маржа: {pct(data.profit?.net_margin_pct)}</div>
        </div>
      </div>
      
      <div className="card-neon p-6">
        <h3 className="text-lg font-mono text-mm-cyan uppercase mb-4">ДЕТАЛИЗАЦИЯ</h3>
        <div className="space-y-3 font-mono text-sm">
          {/* ПРОДАЖИ */}
          <div className="flex justify-between py-2 border-b border-mm-border">
            <span className="text-mm-text-secondary">Реализовано</span>
            <span>{fmt(data.revenue?.realized)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-mm-border">
            <span className="text-mm-text-secondary">+ Выплаты по лояльности</span>
            <span className="text-mm-cyan">+{fmt(data.revenue?.loyalty_payments)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-mm-border">
            <span className="text-mm-text-secondary">+ Баллы за скидки</span>
            <span className="text-mm-cyan">+{fmt(data.revenue?.discount_points)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-mm-border font-bold text-mm-cyan">
            <span>= ВАЛОВАЯ ВЫРУЧКА</span>
            <span>{fmt(data.revenue?.gross_revenue)}</span>
          </div>
          
          {/* ВОЗВРАТЫ */}
          {data.revenue?.returns && data.revenue.returns.total_returned > 0 && (
            <>
              <div className="flex justify-between py-2 border-b border-mm-border bg-mm-gray bg-opacity-20">
                <span className="text-mm-text-secondary">- Возвраты ({data.revenue.returns.returned_quantity} шт.)</span>
                <span className="text-mm-red">-{fmt(data.revenue.returns.total_returned)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-mm-border pl-6 text-xs">
                <span className="text-mm-text-tertiary">└ Возвращено сумма</span>
                <span className="text-mm-text-tertiary">-{fmt(data.revenue.returns.returned_amount)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-mm-border pl-6 text-xs">
                <span className="text-mm-text-tertiary">└ Баллы возврат</span>
                <span className="text-mm-text-tertiary">-{fmt(data.revenue.returns.returned_discounts)}</span>
              </div>
              {data.revenue.returns.returned_loyalty > 0 && (
                <div className="flex justify-between py-2 border-b border-mm-border pl-6 text-xs">
                  <span className="text-mm-text-tertiary">└ Лояльность возврат</span>
                  <span className="text-mm-text-tertiary">-{fmt(data.revenue.returns.returned_loyalty)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-mm-border pl-6 text-xs">
                <span className="text-mm-text-tertiary">└ Комиссия (вернулась)</span>
                <span className="text-mm-cyan">+{fmt(data.revenue.returns.returned_commission_back)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-mm-border font-semibold">
                <span>= ЧИСТАЯ ВЫРУЧКА</span>
                <span>{fmt(data.revenue?.net_revenue)}</span>
              </div>
            </>
          )}
          
          {/* СЕБЕСТОИМОСТЬ */}
          {data.cogs && data.cogs.total > 0 && (
            <>
              <div className="flex justify-between py-2 border-b border-mm-border bg-mm-gray bg-opacity-20">
                <span className="text-mm-text-secondary">- Себестоимость товаров (COGS)</span>
                <span className="text-mm-red">-{fmt(data.cogs.total)}</span>
              </div>
              {data.statistics?.cogs_coverage && (
                <div className="flex justify-between py-2 border-b border-mm-border pl-6 text-xs">
                  <span className="text-mm-text-tertiary">
                    └ Покрытие: {data.statistics.cogs_coverage.items_with_price} из {data.statistics.cogs_coverage.items_with_price + data.statistics.cogs_coverage.items_missing_price} товаров ({data.statistics.cogs_coverage.coverage_pct}%)
                  </span>
                  <span className="text-mm-text-tertiary">{pct(data.cogs.percentage)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-mm-border font-semibold text-mm-cyan">
                <span>= ВАЛОВАЯ ПРИБЫЛЬ</span>
                <span>{fmt(data.profit?.gross_profit)}</span>
              </div>
            </>
          )}
          
          {/* РАСХОДЫ */}
          <div className="flex justify-between py-2 border-b border-mm-border">
            <span className="text-mm-text-secondary">- Базовая комиссия Ozon</span>
            <span className="text-mm-red">-{fmt(data.expenses?.ozon_base_commission)}</span>
          </div>
          {data.expenses?.loyalty_programs > 0 && (
            <div className="flex justify-between py-2 border-b border-mm-border">
              <span className="text-mm-text-secondary">- Выплаты партнерам (баллы)</span>
              <span className="text-mm-red">-{fmt(data.expenses?.loyalty_programs)}</span>
            </div>
          )}
          {data.expenses?.acquiring > 0 && (
            <div className="flex justify-between py-2 border-b border-mm-border">
              <span className="text-mm-text-secondary">- Эквайринг</span>
              <span className="text-mm-red">-{fmt(data.expenses?.acquiring)}</span>
            </div>
          )}
          {data.expenses?.rfbs_logistics > 0 && (
            <div className="flex justify-between py-2 border-b border-mm-border">
              <span className="text-mm-text-secondary">- Логистика rFBS</span>
              <span className="text-mm-red">-{fmt(data.expenses?.rfbs_logistics)}</span>
            </div>
          )}
          {data.expenses?.fbo_fbs_services > 0 && (
            <div className="flex justify-between py-2 border-b border-mm-border">
              <span className="text-mm-text-secondary">- Услуги FBO/FBS</span>
              <span className="text-mm-red">-{fmt(data.expenses?.fbo_fbs_services)}</span>
            </div>
          )}
          {data.expenses?.manual_expenses > 0 && (
            <>
              <div className="flex justify-between py-2 border-b border-mm-border bg-mm-gray bg-opacity-20">
                <span className="text-mm-text-secondary">- Ручные расходы</span>
                <span className="text-mm-red">-{fmt(data.expenses?.manual_expenses)}</span>
              </div>
              {data.expenses?.manual_by_type && Object.keys(data.expenses.manual_by_type).length > 0 && (
                Object.entries(data.expenses.manual_by_type).map(([type, amount]) => (
                  <div key={type} className="flex justify-between py-2 border-b border-mm-border pl-6 text-xs">
                    <span className="text-mm-text-tertiary">└ {type}</span>
                    <span className="text-mm-text-tertiary">-{fmt(amount)}</span>
                  </div>
                ))
              )}
            </>
          )}
          <div className="flex justify-between py-2 border-b border-mm-border font-bold">
            <span className="text-mm-red">= ИТОГО РАСХОДОВ</span>
            <span className="text-mm-red">-{fmt(data.expenses?.total)}</span>
          </div>
          
          {/* ОПЕРАЦИОННАЯ ПРИБЫЛЬ */}
          {data.profit?.operating_profit !== undefined && (
            <div className="flex justify-between py-2 border-b border-mm-border font-semibold text-mm-cyan">
              <span>= ОПЕРАЦИОННАЯ ПРИБЫЛЬ</span>
              <span>{fmt(data.profit?.operating_profit)} ({pct(data.profit?.operating_margin_pct)})</span>
            </div>
          )}
          
          {/* НАЛОГИ */}
          {data.taxes && data.taxes.amount > 0 && (
            <div className="flex justify-between py-2 border-b border-mm-border">
              <span className="text-mm-text-secondary">
                - Налог ({data.taxes.system === 'usn_income' ? 'УСН 6%' :
                          data.taxes.system === 'usn_income_expense' ? 'УСН 15%' :
                          data.taxes.system === 'osn' ? 'ОСН 20%' :
                          data.taxes.system === 'patent' ? 'Патент 6%' :
                          data.taxes.system === 'eshn' ? 'ЕСХН 6%' : data.taxes.rate + '%'})
              </span>
              <span className="text-mm-red">-{fmt(data.taxes.amount)}</span>
            </div>
          )}
          
          {/* ИТОГО */}
          <div className="flex justify-between py-2 border-t-2 border-mm-cyan font-bold text-lg">
            <span className="text-mm-green">= ЧИСТАЯ ПРИБЫЛЬ</span>
            <span className="text-mm-green">{fmt(data.profit?.net_profit)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SalesView({ data, fmt }) {
  return (
    <div className="space-y-6">
      <div className="card-neon p-6">
        <h3 className="text-lg font-mono text-mm-cyan uppercase mb-4">ПРОДАЖИ ПО ТОВАРАМ</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-mm-border">
                <th className="text-left py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">Артикул</th>
                <th className="text-left py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">Товар</th>
                <th className="text-right py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">Кол-во</th>
                <th className="text-right py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">Выручка</th>
                <th className="text-right py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">Комиссия</th>
              </tr>
            </thead>
            <tbody>
              {(data.products || []).map((p, i) => (
                <tr key={i} className="border-b border-mm-border hover:bg-mm-gray">
                  <td className="py-3 px-4 font-mono text-sm text-mm-cyan">{p.article}</td>
                  <td className="py-3 px-4 text-sm">{(p.product_name || '').substring(0, 50)}...</td>
                  <td className="py-3 px-4 text-right font-mono text-sm">{p.quantity}</td>
                  <td className="py-3 px-4 text-right font-mono text-sm">{fmt(p.revenue)}</td>
                  <td className="py-3 px-4 text-right font-mono text-sm text-mm-red">{fmt(p.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 pt-4 border-t border-mm-border font-mono">
          <div className="flex justify-between">
            <span className="text-mm-text-secondary">Всего товаров:</span>
            <span>{data.total_products || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-mm-text-secondary">Всего продано:</span>
            <span>{data.total_quantity || 0} шт</span>
          </div>
          <div className="flex justify-between font-bold text-mm-cyan">
            <span>Общая выручка:</span>
            <span>{fmt(data.total_revenue)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function TransactionsView({ data, fmt, expandedRow, setExpandedRow }) {
  return (
    <div className="card-neon">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-mm-border">
              <th className="text-left py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">Дата</th>
              <th className="text-left py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">Отправление</th>
              <th className="text-left py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">Артикул</th>
              <th className="text-right py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">Выручка</th>
              <th className="text-right py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">Комиссия</th>
              <th className="text-right py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">Прибыль</th>
              <th className="text-center py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono"></th>
            </tr>
          </thead>
          <tbody>
            {(data.transactions || []).map((t) => {
              const profit = t.total_to_accrue || 0
              const expanded = expandedRow === t._id
              return (
                <React.Fragment key={t._id}>
                  <tr className="border-b border-mm-border hover:bg-mm-gray">
                    <td className="py-3 px-4 font-mono text-sm text-mm-text-secondary">
                      {new Date(t.operation_date).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="py-3 px-4 font-mono text-sm text-mm-cyan">{t.posting_number}</td>
                    <td className="py-3 px-4 font-mono text-sm">{t.article}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm">{fmt(t.realized_amount)}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-mm-red">{fmt(t.ozon_base_commission)}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm font-bold text-mm-green">{fmt(profit)}</td>
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => setExpandedRow(expanded ? null : t._id)} className="text-mm-cyan hover:text-mm-text">
                        {expanded ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-mm-gray border-b border-mm-border">
                      <td colSpan="7" className="p-6">
                        <div className="grid grid-cols-2 gap-6 font-mono text-sm">
                          <div>
                            <h4 className="text-mm-cyan uppercase mb-3">ТОВАР</h4>
                            <div className="space-y-2">
                              <div><span className="text-mm-text-secondary">SKU:</span> {t.sku}</div>
                              <div><span className="text-mm-text-secondary">Название:</span> {t.product_name}</div>
                              <div><span className="text-mm-text-secondary">Количество:</span> {t.quantity}</div>
                              <div><span className="text-mm-text-secondary">Цена:</span> {fmt(t.price)}</div>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-mm-cyan uppercase mb-3">ФИНАНСЫ</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between"><span>Реализовано:</span><span>{fmt(t.realized_amount)}</span></div>
                              <div className="flex justify-between text-mm-cyan"><span>+ Лояльность:</span><span>+{fmt(t.loyalty_payments)}</span></div>
                              <div className="flex justify-between text-mm-cyan"><span>+ Баллы:</span><span>+{fmt(t.discount_points)}</span></div>
                              <div className="flex justify-between text-mm-red"><span>- Комиссия:</span><span>-{fmt(t.ozon_base_commission)}</span></div>
                              <div className="flex justify-between pt-2 border-t border-mm-border font-bold text-mm-green"><span>ИТОГО:</span><span>{fmt(profit)}</span></div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="p-4 text-sm text-mm-text-secondary font-mono">
        Всего: {data.total_count || 0} транзакций
      </div>
    </div>
  )
}

export default AnalyticsReportsPage
