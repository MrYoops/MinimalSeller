import React, { useState, useEffect } from 'react'
import { FiX, FiPackage, FiClock, FiFileText } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'
import OrderInfoTab from './OrderInfoTab'
import OrderSplitTab from './OrderSplitTab'
import OrderHistoryTab from './OrderHistoryTab'

function OrderDetailModal({ order, isOpen, onClose, onUpdate }) {
  const { api } = useAuth()
  const [activeTab, setActiveTab] = useState('info')
  const [orderData, setOrderData] = useState(order)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (order && isOpen) {
      loadOrderDetails()
    }
  }, [order, isOpen])

  const loadOrderDetails = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/orders/fbs/${order.id}`)
      setOrderData(response.data)
    } catch (error) {
      console.error('Failed to load order details:', error)
      toast.error('Ошибка загрузки деталей заказа')
    } finally {
      setLoading(false)
    }
  }

  const handleSplit = async (splitData) => {
    try {
      await api.post(`/api/orders/fbs/${order.id}/split`, splitData)
      toast.success('Заказ успешно разделён')
      await loadOrderDetails()
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Failed to split order:', error)
      toast.error('Ошибка разделения заказа: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleStatusUpdate = async (newStatus, comment) => {
    try {
      await api.put(`/api/orders/fbs/${order.id}/status`, {
        status: newStatus,
        comment
      })
      toast.success('Статус заказа обновлён')
      await loadOrderDetails()
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error('Ошибка обновления статуса')
    }
  }

  if (!isOpen || !orderData) return null

  const tabs = [
    { id: 'info', label: 'Основная информация', icon: FiFileText },
    { id: 'split', label: 'Разделение заказа', icon: FiPackage },
    { id: 'history', label: 'История изменений', icon: FiClock }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-mm-dark/80 backdrop-blur-sm" data-testid="order-detail-modal">
      <div className="card-neon w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-mm-border p-6">
          <div>
            <h2 className="text-2xl font-mono text-mm-cyan uppercase mb-1">ЗАКАЗ {orderData.order_number}</h2>
            <p className="text-sm text-mm-text-secondary font-mono">
              // {orderData.marketplace.toUpperCase()} | {new Date(orderData.created_at).toLocaleString('ru-RU')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-mm-border rounded transition-colors"
            data-testid="close-modal"
          >
            <FiX size={24} className="text-mm-text-secondary" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-mm-border px-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-3 font-mono text-sm transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-mm-cyan text-mm-cyan'
                  : 'border-transparent text-mm-text-secondary hover:text-mm-text'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-mm-cyan animate-pulse font-mono">// Загрузка...</p>
            </div>
          ) : (
            <>
              {activeTab === 'info' && (
                <OrderInfoTab
                  order={orderData}
                  onStatusUpdate={handleStatusUpdate}
                />
              )}
              {activeTab === 'split' && (
                <OrderSplitTab
                  order={orderData}
                  onSplit={handleSplit}
                />
              )}
              {activeTab === 'history' && (
                <OrderHistoryTab
                  history={orderData.status_history || []}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-mm-border p-6 flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-6 py-2 font-mono text-mm-text-secondary border border-mm-border rounded hover:bg-mm-border transition-colors"
          >
            ЗАКРЫТЬ
          </button>
        </div>
      </div>
    </div>
  )
}

export default OrderDetailModal
