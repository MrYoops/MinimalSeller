import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import { FiPlus, FiPackage, FiEdit } from 'react-icons/fi'
import { toast } from 'sonner'

function IncomeOrdersPage() {
  const { api } = useAuth()
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
      toast.error('Ошибка загрузки')
      console.error(error)
    }
    setLoading(false)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-mm-cyan uppercase mb-2" data-testid="title">Приёмка на склад</h2>
          <p className="text-mm-text-secondary text-sm">Управление поступлениями</p>
        </div>
        <Link to="/income-orders/new" className="btn-primary flex items-center space-x-2" data-testid="create-btn">
          <FiPlus />
          <span>СОЗДАТЬ ПРИЁМКУ</span>
        </Link>
      </div>

      <div className="card-neon">
        <div className="flex items-center space-x-4">
          <label className="text-sm text-mm-text-secondary uppercase">Статус:</label>
          <div className="flex space-x-2">
            {['all', 'draft', 'accepted'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 text-xs font-mono uppercase border transition-colors ${
                  statusFilter === status
                    ? 'border-mm-cyan text-mm-cyan bg-mm-cyan/10'
                    : 'border-mm-border text-mm-text-secondary hover:border-mm-cyan'
                }`}
                data-testid={`filter-${status}`}
              >
                {status === 'all' ? 'Все' : status === 'draft' ? 'Черновики' : 'Оприходовано'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="card-neon text-center py-16" data-testid="empty-state">
          <FiPackage className="mx-auto text-mm-text-tertiary mb-6" size={64} />
          <p className="text-mm-text-secondary text-lg mb-2">Нет приёмок</p>
          <p className="text-sm text-mm-text-tertiary mb-6">Создайте первую приёмку товара</p>
          <Link to="/income-orders/new" className="btn-primary inline-flex items-center space-x-2">
            <FiPlus />
            <span>СОЗДАТЬ ПРИЁМКУ</span>
          </Link>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-mm-border">
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">№</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Дата</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Поставщик</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Склад</th>
                <th className="text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Позиций</th>
                <th className="text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Кол-во</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Статус</th>
                <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Действия</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors" data-testid={`order-row-${order.id}`}>
                  <td className="py-4 px-4 font-mono text-sm text-mm-cyan">{order.id.substring(0, 8)}</td>
                  <td className="py-4 px-4 text-sm text-mm-text-secondary">{formatDate(order.created_at)}</td>
                  <td className="py-4 px-4 text-sm">{order.supplier_name || '—'}</td>
                  <td className="py-4 px-4 text-sm">{order.warehouse_name || '—'}</td>
                  <td className="py-4 px-4 text-center font-mono text-sm">{order.items?.length || 0}</td>
                  <td className="py-4 px-4 text-center font-mono text-sm text-mm-cyan font-bold">{order.total_quantity || 0}</td>
                  <td className="py-4 px-4">{getStatusBadge(order.status)}</td>
                  <td className="py-4 px-4 text-right">
                    <Link
                      to={`/income-orders/${order.id}/edit`}
                      className="px-3 py-2 border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 transition-colors inline-flex items-center"
                      data-testid={`edit-order-${order.id}`}
                    >
                      <FiEdit size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default IncomeOrdersPage
