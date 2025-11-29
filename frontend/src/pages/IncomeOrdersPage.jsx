import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { FiPlus, FiPackage, FiCheck, FiEdit } from 'react-icons/fi'
import { toast } from 'sonner'

function IncomeOrdersPage() {
  const { api } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    loadOrders()
  }, [statusFilter])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : ''
      const response = await api.get(`/api/income-orders${params}`)
      setOrders(response.data)
    } catch (error) {
      toast.error('Ошибка загрузки приёмок')
      console.error(error)
    }
    setLoading(false)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    })
  }

  const getStatusBadge = (status) => {
    if (status === 'draft') {
      return <span className="px-3 py-1 text-xs font-mono uppercase bg-mm-yellow/20 text-mm-yellow border border-mm-yellow">Черновик</span>
    } else if (status === 'accepted') {
      return <span className="px-3 py-1 text-xs font-mono uppercase bg-mm-green/20 text-mm-green border border-mm-green">Оприходовано</span>
    }
    return <span className="px-3 py-1 text-xs font-mono uppercase bg-mm-text-tertiary/20 text-mm-text-tertiary">{status}</span>
  }

  return (
    <div className="min-h-screen bg-mm-black text-mm-text p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-mm-cyan uppercase mb-2" data-testid="income-orders-title">Приёмка на склад</h1>
            <p className="text-mm-text-secondary text-sm">// Управление поступлениями товаров</p>
          </div>
          <Link
            to="/income-orders/new"
            className="btn-primary flex items-center space-x-2"
            data-testid="create-income-order-btn"
          >
            <FiPlus />
            <span>СОЗДАТЬ ПРИЁМКУ</span>
          </Link>
        </div>

        {/* Filters */}
        <div className="card-neon">
          <div className="flex items-center space-x-4">
            <label className="text-sm text-mm-text-secondary uppercase">Статус:</label>
            <div className="flex space-x-2">
              {['all', 'draft', 'accepted'].map((status) => (\n                <button\n                  key={status}\n                  onClick={() => setStatusFilter(status)}\n                  className={`px-4 py-2 text-xs font-mono uppercase border transition-colors ${\n                    statusFilter === status\n                      ? 'border-mm-cyan text-mm-cyan bg-mm-cyan/10'\n                      : 'border-mm-border text-mm-text-secondary hover:border-mm-cyan'\n                  }`}\n                  data-testid={`filter-${status}`}\n                >\n                  {status === 'all' ? 'Все' : status === 'draft' ? 'Черновики' : 'Оприходовано'}\n                </button>\n              ))}\n            </div>\n          </div>\n        </div>\n\n        {/* Orders Table */}\n        {loading ? (\n          <div className=\"text-center py-12\">\n            <p className=\"text-mm-cyan animate-pulse\">// LOADING...</p>\n          </div>\n        ) : orders.length === 0 ? (\n          <div className=\"card-neon text-center py-16\" data-testid=\"empty-state\">\n            <FiPackage className=\"mx-auto text-mm-text-tertiary mb-6\" size={64} />\n            <p className=\"text-mm-text-secondary text-lg mb-2\">Нет приёмок</p>\n            <p className=\"text-sm text-mm-text-tertiary mb-6\">// Создайте первую приёмку товара</p>\n            <Link to=\"/income-orders/new\" className=\"btn-primary inline-flex items-center space-x-2\">\n              <FiPlus />\n              <span>СОЗДАТЬ ПРИЁМКУ</span>\n            </Link>\n          </div>\n        ) : (\n          <div className=\"card-neon overflow-hidden\">\n            <table className=\"w-full\">\n              <thead>\n                <tr className=\"border-b border-mm-border\">\n                  <th className=\"text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono\">№</th>\n                  <th className=\"text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono\">Дата</th>\n                  <th className=\"text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono\">Поставщик</th>\n                  <th className=\"text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono\">Склад</th>\n                  <th className=\"text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono\">Позиций</th>\n                  <th className=\"text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono\">Кол-во</th>\n                  <th className=\"text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono\">Статус</th>\n                  <th className=\"text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono\">Действия</th>\n                </tr>\n              </thead>\n              <tbody>\n                {orders.map((order) => (\n                  <tr key={order.id} className=\"border-b border-mm-border hover:bg-mm-gray transition-colors\" data-testid={`order-row-${order.id}`}>\n                    <td className=\"py-4 px-4 font-mono text-sm text-mm-cyan\">{order.id.substring(0, 8)}</td>\n                    <td className=\"py-4 px-4 text-sm text-mm-text-secondary\">{formatDate(order.created_at)}</td>\n                    <td className=\"py-4 px-4 text-sm\">{order.supplier_name || '—'}</td>\n                    <td className=\"py-4 px-4 text-sm\">{order.warehouse_name || '—'}</td>\n                    <td className=\"py-4 px-4 text-center font-mono text-sm\">{order.items?.length || 0}</td>\n                    <td className=\"py-4 px-4 text-center font-mono text-sm text-mm-cyan font-bold\">{order.total_quantity || 0}</td>\n                    <td className=\"py-4 px-4\">{getStatusBadge(order.status)}</td>\n                    <td className=\"py-4 px-4 text-right\">\n                      <Link\n                        to={`/income-orders/${order.id}/edit`}\n                        className=\"px-3 py-2 border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 transition-colors inline-flex items-center\"\n                        data-testid={`edit-order-${order.id}`}\n                      >\n                        <FiEdit size={16} />\n                      </Link>\n                    </td>\n                  </tr>\n                ))}\n              </tbody>\n            </table>\n          </div>\n        )}\n      </div>\n    </div>\n  )\n}\n\nexport default IncomeOrdersPage\n