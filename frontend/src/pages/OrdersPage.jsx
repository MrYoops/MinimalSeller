import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiPackage, FiTruck, FiCheckCircle, FiXCircle, FiClock } from 'react-icons/fi'

function OrdersPage() {
  const { api } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ status: '', source: '' })

  useEffect(() => {
    loadOrders()
  }, [filter])

  const loadOrders = async () => {
    try {
      const params = new URLSearchParams()
      if (filter.status) params.append('status', filter.status)
      if (filter.source) params.append('source', filter.source)
      
      const response = await api.get(`/api/orders?${params.toString()}`)
      setOrders(response.data)
    } catch (error) {
      console.error('Failed to load orders:', error)
    }
    setLoading(false)
  }

  const getStatusIcon = (status) => {
    switch(status) {
      case 'new': return <FiClock className="inline text-mm-blue" />
      case 'awaiting_shipment': return <FiPackage className="inline text-mm-yellow" />
      case 'shipped': return <FiTruck className="inline text-mm-cyan" />
      case 'delivered': return <FiCheckCircle className="inline text-mm-green" />
      case 'cancelled': return <FiXCircle className="inline text-mm-red" />
      default: return <FiClock className="inline" />
    }
  }

  const getSourceBadge = (source) => {
    const colors = {
      'minimalmod': 'border-mm-purple text-mm-purple',
      'ozon': 'border-mm-blue text-mm-blue',
      'wildberries': 'border-mm-purple text-mm-purple',
      'yandex_market': 'border-mm-yellow text-mm-yellow'
    }
    return colors[source] || 'border-mm-cyan text-mm-cyan'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl mb-2 text-mm-cyan uppercase">Orders</h2>
          <p className="comment">// Manage all your orders</p>
        </div>
        <div className="flex space-x-4">
          <select
            value={filter.status}
            onChange={(e) => setFilter({...filter, status: e.target.value})}
            className="input-neon"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="awaiting_shipment">Awaiting Shipment</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={filter.source}
            onChange={(e) => setFilter({...filter, source: e.target.value})}
            className="input-neon"
          >
            <option value="">All Sources</option>
            <option value="minimalmod">MinimalMod</option>
            <option value="ozon">Ozon</option>
            <option value="wildberries">Wildberries</option>
            <option value="yandex_market">Yandex.Market</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiPackage className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2">No orders found</p>
          <p className="comment">// Orders will appear here once created</p>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-mm-border">
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Order #</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Date</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Customer</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Source</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Total</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Status</th>
                  <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                    <td className="py-4 px-4 font-mono text-sm text-mm-cyan">
                      {order.order_number}
                    </td>
                    <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                      {new Date(order.dates?.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 font-mono text-sm">
                      {order.customer?.name || 'N/A'}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2 py-1 text-xs font-mono border ${getSourceBadge(order.source)}`}>
                        {order.source}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-sm">
                      ₽{order.totals?.total?.toLocaleString() || 0}
                    </td>
                    <td className="py-4 px-4">
                      <span className="flex items-center space-x-2">
                        {getStatusIcon(order.status)}
                        <span className="text-sm font-mono uppercase">{order.status}</span>
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => window.location.href = `/orders/${order.id}`}
                        className="px-3 py-1 border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 transition-colors text-xs uppercase font-mono"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrdersPage
