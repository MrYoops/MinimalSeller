import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiPackage, FiUser, FiTruck, FiDollarSign, FiX, FiPrinter, FiCheckCircle } from 'react-icons/fi'

function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { api } = useAuth()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOrder()
  }, [id])

  const loadOrder = async () => {
    try {
      const response = await api.get(`/api/orders/${id}`)
      setOrder(response.data)
    } catch (error) {
      console.error('Failed to load order:', error)
      alert('Failed to load order')
    }
    setLoading(false)
  }

  const updateStatus = async (newStatus) => {
    try {
      await api.put(`/api/orders/${id}/status`, null, {
        params: { status: newStatus }
      })
      loadOrder()
      alert('Status updated!')
    } catch (error) {
      alert('Failed to update status')
    }
  }

  const createCDEKLabel = async () => {
    alert('СДЭК интеграция: Создание накладной...')
    // TODO: Реальная интеграция с СДЭК API
  }

  const printLabel = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mm-black flex items-center justify-center">
        <p className="text-mm-cyan animate-pulse">// LOADING...</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-mm-black flex items-center justify-center">
        <p className="text-mm-red">Order not found</p>
      </div>
    )
  }

  const getSourceColor = (source) => {
    const colors = {
      'minimalmod': 'text-mm-purple',
      'ozon': 'text-mm-blue',
      'wildberries': 'text-mm-purple',
      'yandex_market': 'text-mm-yellow'
    }
    return colors[source] || 'text-mm-cyan'
  }

  return (
    <div className="min-h-screen bg-mm-black">
      {/* Header */}
      <header className="border-b border-mm-border bg-mm-darker sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-mm-cyan uppercase">
                Order #{order.order_number}
              </h1>
              <span className={`font-mono text-sm ${getSourceColor(order.source)}`}>
                {order.source}
              </span>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="btn-secondary"
              data-testid="close-order-button"
            >
              <FiX className="inline mr-2" />
              Close
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Left */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <div className="card-neon">
              <h3 className="text-xl mb-4 text-mm-cyan uppercase flex items-center">
                <FiPackage className="mr-2" />
                Order Items
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-mm-border">
                      <th className="text-left py-3 px-2 text-mm-text-secondary uppercase text-xs font-mono">SKU</th>
                      <th className="text-left py-3 px-2 text-mm-text-secondary uppercase text-xs font-mono">Name</th>
                      <th className="text-left py-3 px-2 text-mm-text-secondary uppercase text-xs font-mono">Qty</th>
                      <th className="text-left py-3 px-2 text-mm-text-secondary uppercase text-xs font-mono">Price</th>
                      <th className="text-right py-3 px-2 text-mm-text-secondary uppercase text-xs font-mono">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items?.map((item, idx) => (
                      <tr key={idx} className="border-b border-mm-border">
                        <td className="py-3 px-2 font-mono text-sm text-mm-cyan">{item.sku}</td>
                        <td className="py-3 px-2 font-mono text-sm">{item.name}</td>
                        <td className="py-3 px-2 font-mono text-sm">{item.quantity}</td>
                        <td className="py-3 px-2 font-mono text-sm">₽{item.price.toLocaleString()}</td>
                        <td className="py-3 px-2 font-mono text-sm text-right">₽{item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-6 pt-4 border-t border-mm-border space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-mm-text-secondary">Subtotal</span>
                  <span className="font-mono">₽{order.totals?.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-mm-text-secondary">Shipping</span>
                  <span className="font-mono">₽{order.totals?.shipping_cost.toLocaleString()}</span>
                </div>
                {order.totals?.marketplace_commission > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-mm-text-secondary">Commission</span>
                    <span className="font-mono text-mm-red">-₽{order.totals?.marketplace_commission.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-mm-border font-bold text-lg">
                  <span>TOTAL</span>
                  <span className="text-mm-green">₽{order.totals?.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="card-neon">
              <h3 className="text-xl mb-4 text-mm-cyan uppercase flex items-center">
                <FiUser className="mr-2" />
                Customer Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="comment text-xs mb-1">// Name</p>
                  <p className="font-mono">{order.customer?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="comment text-xs mb-1">// Phone</p>
                  <p className="font-mono">{order.customer?.phone || 'N/A'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="comment text-xs mb-1">// Email</p>
                  <p className="font-mono">{order.customer?.email || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Shipping Info */}
            <div className="card-neon">
              <h3 className="text-xl mb-4 text-mm-cyan uppercase flex items-center">
                <FiTruck className="mr-2" />
                Shipping Information
              </h3>
              
              <div className="space-y-3">
                <div>
                  <p className="comment text-xs mb-1">// Method</p>
                  <p className="font-mono">{order.shipping?.method || 'N/A'}</p>
                </div>
                <div>
                  <p className="comment text-xs mb-1">// Address</p>
                  <p className="font-mono">{order.shipping?.address || 'N/A'}</p>
                </div>
                {order.shipping?.tracking_number && (
                  <div>
                    <p className="comment text-xs mb-1">// Tracking Number</p>
                    <p className="font-mono text-mm-cyan text-lg">{order.shipping.tracking_number}</p>
                  </div>
                )}
                {order.shipping?.status && (
                  <div>
                    <p className="comment text-xs mb-1">// Delivery Status</p>
                    <p className="font-mono text-mm-green">{order.shipping.status}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Order History */}
            <div className="card-neon">
              <h3 className="text-xl mb-4 text-mm-cyan uppercase">Order History</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-mm-green rounded-full mt-2"></div>
                  <div>
                    <p className="font-mono text-sm text-mm-green">Order Created</p>
                    <p className="comment text-xs">{new Date(order.dates?.created_at).toLocaleString()}</p>
                  </div>
                </div>
                {order.dates?.shipped_at && (
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-mm-cyan rounded-full mt-2"></div>
                    <div>
                      <p className="font-mono text-sm text-mm-cyan">Shipped</p>
                      <p className="comment text-xs">{new Date(order.dates.shipped_at).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Right */}
          <div className="lg:col-span-1 space-y-6">
            {/* Status */}
            <div className="card-neon">
              <h3 className="text-lg mb-4 text-mm-cyan uppercase">Status</h3>
              <div className="mb-4">
                <span className={`px-4 py-2 border-2 font-mono uppercase text-sm ${
                  order.status === 'new' ? 'border-mm-blue text-mm-blue' :
                  order.status === 'awaiting_shipment' ? 'border-mm-yellow text-mm-yellow' :
                  order.status === 'shipped' ? 'border-mm-cyan text-mm-cyan' :
                  order.status === 'delivered' ? 'border-mm-green text-mm-green' :
                  'border-mm-red text-mm-red'
                }`}>
                  {order.status}
                </span>
              </div>
              
              <div className="space-y-2">
                {order.status === 'new' && (
                  <button
                    onClick={() => updateStatus('awaiting_shipment')}
                    className="btn-primary w-full"
                  >
                    Mark as Awaiting Shipment
                  </button>
                )}
                {order.status === 'awaiting_shipment' && (
                  <button
                    onClick={() => updateStatus('shipped')}
                    className="btn-primary w-full"
                  >
                    Mark as Shipped
                  </button>
                )}
                <button
                  onClick={() => updateStatus('cancelled')}
                  className="btn-secondary w-full text-mm-red border-mm-red"
                >
                  Cancel Order
                </button>
              </div>
            </div>

            {/* Payment */}
            <div className="card-neon">
              <h3 className="text-lg mb-4 text-mm-cyan uppercase">Payment</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="comment">Status:</span>
                  <span className={`font-mono ${order.payment?.status === 'paid' ? 'text-mm-green' : 'text-mm-yellow'}`}>
                    {order.payment?.status || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="comment">Method:</span>
                  <span className="font-mono">{order.payment?.method || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* СДЭК Actions */}
            <div className="card-neon">
              <h3 className="text-lg mb-4 text-mm-cyan uppercase">CDEK Integration</h3>
              <div className="space-y-2">
                {!order.shipping?.tracking_number ? (
                  <button
                    onClick={createCDEKLabel}
                    className="btn-primary w-full"
                    data-testid="create-cdek-label"
                  >
                    <FiCheckCircle className="inline mr-2" />
                    Create CDEK Label
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={printLabel}
                      className="btn-secondary w-full"
                    >
                      <FiPrinter className="inline mr-2" />
                      Print Label
                    </button>
                    <button
                      onClick={printLabel}
                      className="btn-secondary w-full"
                    >
                      <FiPrinter className="inline mr-2" />
                      Print Picking List
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Order Info */}
            <div className="card-neon">
              <h3 className="text-lg mb-4 text-mm-cyan uppercase">Order Info</h3>
              <div className="space-y-2">
                <div>
                  <p className="comment text-xs">// Order Number</p>
                  <p className="font-mono text-mm-cyan">{order.order_number}</p>
                </div>
                <div>
                  <p className="comment text-xs">// Created</p>
                  <p className="font-mono text-sm">{new Date(order.dates?.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="comment text-xs">// Source</p>
                  <p className={`font-mono ${getSourceColor(order.source)}`}>{order.source}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrderDetailPage
