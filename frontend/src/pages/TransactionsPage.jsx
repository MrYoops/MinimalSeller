import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'

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

function TransactionsPage() {
  const { api } = useAuth()
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth())
  const [dateTo, setDateTo] = useState(getToday())
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [expandedRow, setExpandedRow] = useState(null)

  const loadTransactions = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/profit-analytics/transactions', {
        params: {
          date_from: dateFrom,
          date_to: dateTo,
          limit: limit,
          offset: offset
        }
      })
      
      setTransactions(response.data.transactions || [])
      setTotalCount(response.data.total_count || 0)
    } catch (error) {
      console.error('Failed to load transactions:', error)
      alert('Ошибка загрузки: ' + (error.response?.data?.detail || error.message))
    }
    setLoading(false)
  }

  useEffect(() => {
    loadTransactions()
  }, [offset])

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) amount = 0
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const toggleExpand = (transactionId) => {
    setExpandedRow(expandedRow === transactionId ? null : transactionId)
  }

  const nextPage = () => {
    if (offset + limit < totalCount) {
      setOffset(offset + limit)
    }
  }

  const prevPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit))
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h2 className="text-2xl mb-2 text-mm-cyan uppercase">ТРАНЗАКЦИИ</h2>
        <p className="comment">// Детализация всех финансовых операций</p>
      </div>

      <div className="card-neon p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-mm-text-secondary mb-2 font-mono">ПЕРИОД С:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-mono w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm text-mm-text-secondary mb-2 font-mono">ПО:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-mono w-full"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setOffset(0)
                loadTransactions()
              }}
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'ЗАГРУЗКА...' : 'ПОКАЗАТЬ'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// ЗАГРУЗКА...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="card-neon text-center py-12">
          <p className="text-mm-text-secondary mb-2">Нет транзакций</p>
          <p className="comment">// Выполните синхронизацию данных</p>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-mm-border">
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Дата</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Номер заказа</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Товары</th>
                  <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Сумма</th>
                  <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Расходы</th>
                  <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Прибыль</th>
                  <th className="text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Детали</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => {
                  const totalExpenses = (
                    (txn.breakdown?.commission?.total || 0) +
                    (txn.breakdown?.logistics?.total || 0) +
                    (txn.breakdown?.services?.total || 0) +
                    (txn.breakdown?.penalties?.total || 0)
                  )
                  const profit = txn.amount - totalExpenses
                  const isExpanded = expandedRow === txn._id

                  return (
                    <React.Fragment key={txn._id}>
                      <tr className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                        <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                          {formatDate(txn.operation_date)}
                        </td>
                        <td className="py-4 px-4 font-mono text-sm text-mm-cyan">
                          {txn.order_id || '-'}
                        </td>
                        <td className="py-4 px-4 text-sm">
                          {txn.items?.length || 0} шт
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-sm">
                          {formatCurrency(txn.amount)}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-sm text-mm-red">
                          {formatCurrency(totalExpenses)}
                        </td>
                        <td className={`py-4 px-4 text-right font-mono text-sm font-bold ${profit >= 0 ? 'text-mm-green' : 'text-mm-red'}`}>
                          {formatCurrency(profit)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button
                            onClick={() => toggleExpand(txn._id)}
                            className="text-mm-cyan hover:text-mm-text transition-colors"
                          >
                            {isExpanded ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
                          </button>
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr className="bg-mm-gray border-b border-mm-border">
                          <td colSpan="7" className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-sm">
                              <div>
                                <h4 className="text-mm-cyan uppercase mb-3">ТОВАРЫ</h4>
                                <div className="space-y-2">
                                  {txn.items?.map((item, idx) => (
                                    <div key={idx} className="flex justify-between">
                                      <span className="text-mm-text-secondary">{item.name || item.sku}</span>
                                      <span>{formatCurrency(item.price)} × {item.quantity}</span>
                                    </div>
                                  )) || <p className="text-mm-text-tertiary">Нет данных</p>}
                                </div>
                              </div>

                              <div>
                                <h4 className="text-mm-red uppercase mb-3">РАСХОДЫ</h4>
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span className="text-mm-text-secondary">Комиссия МП</span>
                                    <span>{formatCurrency(txn.breakdown?.commission?.total)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-mm-text-secondary">Логистика</span>
                                    <span>{formatCurrency(txn.breakdown?.logistics?.total)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-mm-text-secondary">Услуги</span>
                                    <span>{formatCurrency(txn.breakdown?.services?.total)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-mm-text-secondary">Штрафы</span>
                                    <span>{formatCurrency(txn.breakdown?.penalties?.total)}</span>
                                  </div>
                                  <div className="flex justify-between pt-2 border-t border-mm-border font-bold text-mm-red">
                                    <span>ИТОГО</span>
                                    <span>{formatCurrency(totalExpenses)}</span>
                                  </div>
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

          <div className="p-4 border-t border-mm-border flex items-center justify-between">
            <div className="text-sm text-mm-text-secondary font-mono">
              Показано {offset + 1}-{Math.min(offset + limit, totalCount)} из {totalCount}
            </div>
            <div className="flex gap-2">
              <button
                onClick={prevPage}
                disabled={offset === 0}
                className="btn-secondary text-sm"
              >
                ← Назад
              </button>
              <button
                onClick={nextPage}
                disabled={offset + limit >= totalCount}
                className="btn-secondary text-sm"
              >
                Вперед →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TransactionsPage
