import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiDownload, FiRefreshCw, FiDollarSign, FiTrendingUp, FiTrendingDown } from 'react-icons/fi'

// Утилита для получения даты в формате YYYY-MM-DD
const getDateString = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Получить первый день текущего месяца
const getFirstDayOfMonth = () => {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  return getDateString(firstDay)
}

// Получить сегодняшнюю дату
const getToday = () => {
  return getDateString(new Date())
}

function ProfitReportPage() {
  const { api } = useAuth()
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth())
  const [dateTo, setDateTo] = useState(getToday())

  const syncData = async () => {
    setSyncing(true)
    setError(null)
    try {
      const response = await api.post('/api/profit-analytics/sync-ozon-data', null, {
        params: { date_from: dateFrom, date_to: dateTo }
      })
      
      alert(`✅ Синхронизация завершена!\n\nВсего транзакций: ${response.data.statistics.total_transactions}\nСохранено: ${response.data.statistics.saved}\nОбновлено: ${response.data.statistics.updated}`)
      
      // Автоматически загрузить отчет
      await loadReport()
    } catch (error) {
      console.error('Sync failed:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Неизвестная ошибка'
      setError(`Ошибка синхронизации: ${errorMessage}`)
    }
    setSyncing(false)
  }

  const loadReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/api/profit-analytics/profit-report', {
        params: { date_from: dateFrom, date_to: dateTo }
      })
      
      console.log('Report response:', response.data)
      
      // Проверяем что данные корректные
      if (response.data && response.data.revenue && response.data.expenses && response.data.profit) {
        setReport(response.data)
      } else {
        setError('Нет данных за выбранный период')
        setReport(null)
      }
    } catch (error) {
      console.error('Failed to load report:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Неизвестная ошибка'
      setError(`Ошибка загрузки отчета: ${errorMessage}`)
      setReport(null)
    }
    setLoading(false)
  }

  const exportToExcel = async () => {
    try {
      const response = await api.get('/api/profit-analytics/export-profit-report', {
        params: { date_from: dateFrom, date_to: dateTo },
        responseType: 'blob'
      })
      
      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `profit_report_${dateFrom}_${dateTo}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      
      alert('✅ Отчет экспортирован!')
    } catch (error) {
      console.error('Export failed:', error)
      alert('❌ Ошибка экспорта')
    }
  }

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      amount = 0
    }
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatPercent = (percent) => {
    if (percent === undefined || percent === null || isNaN(percent)) {
      percent = 0
    }
    return `${percent.toFixed(2)}%`
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Заголовок */}
      <div>
        <h2 className="text-2xl mb-2 text-mm-cyan uppercase">ОТЧЕТ О ЧИСТОЙ ПРИБЫЛИ</h2>
        <p className="comment">// Детальная аналитика доходов и расходов</p>
      </div>

      {/* Панель фильтров */}
      <div className="card-neon p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-mm-text-secondary mb-2 font-mono">
              ПЕРИОД С:
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-mono w-full"
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
              className="input-mono w-full"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={syncData}
              disabled={syncing}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <FiRefreshCw className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'СИНХРОНИЗАЦИЯ...' : 'СИНХРОНИЗИРОВАТЬ'}
            </button>
          </div>

          <div className="flex items-end">
            <button
              onClick={loadReport}
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'ЗАГРУЗКА...' : 'ПОКАЗАТЬ ОТЧЕТ'}
            </button>
          </div>
        </div>

        {report && (
          <div className="mt-4 pt-4 border-t border-mm-border flex justify-end">
            <button
              onClick={exportToExcel}
              className="btn-secondary flex items-center gap-2"
            >
              <FiDownload />
              ЭКСПОРТ В EXCEL
            </button>
          </div>
        )}
      </div>

      {/* Сообщение об ошибке */}
      {error && (
        <div className="card-neon p-6 border-mm-red border-2">
          <p className="text-mm-red">{error}</p>
        </div>
      )}

      {/* Отчет */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// ЗАГРУЗКА ОТЧЕТА...</p>
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Карточки с ключевыми метриками */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Выручка */}
            <div className="card-neon p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-mm-text-secondary font-mono">ВЫРУЧКА</div>
                <FiDollarSign className="text-mm-cyan" size={24} />
              </div>
              <div className="text-3xl font-mono text-mm-cyan mb-2">
                {formatCurrency(report?.revenue?.net_sales)}
              </div>
              <div className="text-xs text-mm-text-tertiary font-mono">
                Валовая: {formatCurrency(report?.revenue?.gross_sales)}
              </div>
            </div>

            {/* Расходы */}
            <div className="card-neon p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-mm-text-secondary font-mono">РАСХОДЫ</div>
                <FiTrendingDown className="text-mm-red" size={24} />
              </div>
              <div className="text-3xl font-mono text-mm-red mb-2">
                {formatCurrency(report?.expenses?.total_expenses)}
              </div>
              <div className="text-xs text-mm-text-tertiary font-mono">
                Всего издержек
              </div>
            </div>

            {/* Чистая прибыль */}
            <div className="card-neon p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-mm-text-secondary font-mono">ЧИСТАЯ ПРИБЫЛЬ</div>
                <FiTrendingUp className={(report?.profit?.net_profit ?? 0) >= 0 ? 'text-mm-green' : 'text-mm-red'} size={24} />
              </div>
              <div className={`text-3xl font-mono mb-2 ${(report?.profit?.net_profit ?? 0) >= 0 ? 'text-mm-green' : 'text-mm-red'}`}>
                {formatCurrency(report?.profit?.net_profit)}
              </div>
              <div className="text-xs text-mm-text-tertiary font-mono">
                Маржа: {formatPercent(report?.profit?.net_margin_pct)}
              </div>
            </div>
          </div>

          {/* Детальный отчет */}
          <div className="card-neon overflow-hidden">
            <div className="p-6 border-b border-mm-border">
              <h3 className="text-lg font-mono text-mm-cyan uppercase">ОТЧЕТ О ПРИБЫЛЯХ И УБЫТКАХ (P&L)</h3>
              <p className="comment mt-1">// Период: {dateFrom} - {dateTo}</p>
              {report?.statistics && (
                <p className="comment">// Транзакций: {report.statistics.total_transactions || 0}</p>
              )}
            </div>

            <div className="p-6 space-y-6 font-mono">
              {/* ДОХОДЫ */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-6 bg-mm-cyan"></div>
                  <h4 className="text-mm-cyan uppercase">ДОХОДЫ</h4>
                </div>
                <div className="pl-6 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-mm-text-secondary">Валовая выручка</span>
                    <span>{formatCurrency(report?.revenue?.gross_sales)}</span>
                  </div>
                  <div className="flex justify-between text-mm-red">
                    <span className="text-mm-text-secondary">Возвраты</span>
                    <span>{formatCurrency(report?.revenue?.returns)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-mm-border font-bold text-mm-cyan">
                    <span>Чистая выручка</span>
                    <span>{formatCurrency(report?.revenue?.net_sales)}</span>
                  </div>
                </div>
              </div>

              {/* РАСХОДЫ */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-6 bg-mm-red"></div>
                  <h4 className="text-mm-red uppercase">РАСХОДЫ</h4>
                </div>
                
                {/* Комиссии */}
                <div className="pl-6 space-y-2 text-sm mb-4">
                  <div className="text-mm-text-secondary mb-2">1️⃣ КОМИССИИ МАРКЕТПЛЕЙСА</div>
                  <div className="pl-4 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-mm-text-tertiary">├─ Базовая комиссия</span>
                      <span>{formatCurrency(report?.expenses?.commissions?.marketplace_base)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mm-text-tertiary">└─ Комиссия от бонусов (9%)</span>
                      <span>{formatCurrency(report?.expenses?.commissions?.bonus_commission)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-1">
                      <span>ИТОГО комиссии</span>
                      <span>{formatCurrency(report?.expenses?.commissions?.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Логистика */}
                <div className="pl-6 space-y-2 text-sm mb-4">
                  <div className="text-mm-text-secondary mb-2">2️⃣ ЛОГИСТИКА</div>
                  <div className="pl-4 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-mm-text-tertiary">├─ Доставка до покупателя</span>
                      <span>{formatCurrency(report?.expenses?.logistics?.delivery_to_customer)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mm-text-tertiary">├─ Последняя миля</span>
                      <span>{formatCurrency(report?.expenses?.logistics?.last_mile)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mm-text-tertiary">└─ Возвратная логистика</span>
                      <span>{formatCurrency(report?.expenses?.logistics?.returns)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-1">
                      <span>ИТОГО логистика</span>
                      <span>{formatCurrency(report?.expenses?.logistics?.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Услуги */}
                <div className="pl-6 space-y-2 text-sm mb-4">
                  <div className="text-mm-text-secondary mb-2">3️⃣ УСЛУГИ МАРКЕТПЛЕЙСА</div>
                  <div className="pl-4 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-mm-text-tertiary">├─ Хранение</span>
                      <span>{formatCurrency(report?.expenses?.services?.storage)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mm-text-tertiary">├─ Эквайринг</span>
                      <span>{formatCurrency(report?.expenses?.services?.acquiring)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mm-text-tertiary">├─ Выдача на ПВЗ</span>
                      <span>{formatCurrency(report?.expenses?.services?.pvz_fees)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-mm-text-tertiary">└─ Упаковка</span>
                      <span>{formatCurrency(report?.expenses?.services?.packaging)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-1">
                      <span>ИТОГО услуги</span>
                      <span>{formatCurrency(report?.expenses?.services?.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Штрафы */}
                <div className="pl-6 space-y-2 text-sm mb-4">
                  <div className="text-mm-text-secondary mb-2">4️⃣ ШТРАФЫ</div>
                  <div className="pl-4 space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>ИТОГО штрафы</span>
                      <span>{formatCurrency(report?.expenses?.penalties?.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Прочие расходы */}
                <div className="pl-6 space-y-2 text-sm mb-4">
                  <div className="text-mm-text-secondary mb-2">5️⃣ ПРОЧИЕ РАСХОДЫ</div>
                  <div className="pl-4 space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>ИТОГО прочие</span>
                      <span>{formatCurrency(report?.expenses?.other_expenses?.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Итого расходов */}
                <div className="pl-6 pt-4 border-t border-mm-border">
                  <div className="flex justify-between font-bold text-lg text-mm-red">
                    <span>ИТОГО РАСХОДОВ</span>
                    <span>{formatCurrency(report?.expenses?.total_expenses)}</span>
                  </div>
                </div>
              </div>

              {/* ПРИБЫЛЬ */}
              <div className="pt-4 border-t-2 border-mm-cyan">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-6 bg-mm-green"></div>
                  <h4 className={(report?.profit?.net_profit ?? 0) >= 0 ? 'text-mm-green uppercase' : 'text-mm-red uppercase'}>
                    ЧИСТАЯ ПРИБЫЛЬ
                  </h4>
                </div>
                <div className="pl-6">
                  <div className={`flex justify-between text-2xl font-bold ${(report?.profit?.net_profit ?? 0) >= 0 ? 'text-mm-green' : 'text-mm-red'}`}>
                    <span>ЧИСТАЯ ПРИБЫЛЬ</span>
                    <span>{formatCurrency(report?.profit?.net_profit)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-mm-text-secondary mt-2">
                    <span>Чистая маржа</span>
                    <span>{formatPercent(report?.profit?.net_margin_pct)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : !loading && !error ? (
        <div className="card-neon text-center py-12">
          <p className="text-mm-text-secondary mb-2">Выберите период и нажмите "ПОКАЗАТЬ ОТЧЕТ"</p>
          <p className="comment">// Перед просмотром отчета необходимо синхронизировать данные</p>
        </div>
      ) : null}
    </div>
  )
}

export default ProfitReportPage
