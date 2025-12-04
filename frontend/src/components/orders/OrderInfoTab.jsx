import React, { useState } from 'react'
import { FiUser, FiMapPin, FiPackage, FiDollarSign, FiPrinter, FiRefreshCw } from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'

function OrderInfoTab({ order, onStatusUpdate }) {
  const { api } = useAuth()
  const [loadingLabel, setLoadingLabel] = useState(false)

  const getStatusBadge = (status) => {
    const statusConfig = {
      'new': { color: 'bg-mm-blue/20 text-mm-blue border-mm-blue', label: 'Новый' },
      'awaiting_shipment': { color: 'bg-mm-yellow/20 text-mm-yellow border-mm-yellow', label: 'Ожидает отгрузки' },
      'delivering': { color: 'bg-mm-cyan/20 text-mm-cyan border-mm-cyan', label: 'Доставляется' },
      'delivered': { color: 'bg-mm-green/20 text-mm-green border-mm-green', label: 'Доставлен' },
      'cancelled': { color: 'bg-mm-red/20 text-mm-red border-mm-red', label: 'Отменён' },
      'imported': { color: 'bg-mm-blue/20 text-mm-blue border-mm-blue', label: 'Загружен' }
    }
    const config = statusConfig[status] || { color: 'bg-mm-gray text-mm-text-secondary border-mm-border', label: status }
    return (
      <span className={`px-3 py-1 text-sm font-mono border rounded ${config.color}`}>
        {config.label}
      </span>
    )
  }

  const handlePrintLabel = async () => {
    try {
      setLoadingLabel(true)
      const response = await api.get(`/api/orders/fbs/${order.id}/label`)
      
      if (response.data.label_url) {
        // Открыть PDF в новом окне
        window.open(response.data.label_url, '_blank')
        toast.success('Этикетка загружена')
      } else {
        toast.error('Этикетка недоступна')
      }
    } catch (error) {
      console.error('Failed to print label:', error)
      toast.error('Ошибка загрузки этикетки: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoadingLabel(false)
    }
  }

  const handleRefreshLabel = async () => {
    try {
      setLoadingLabel(true)
      await api.post(`/api/orders/fbs/${order.id}/label/refresh`)
      toast.success('Этикетка обновлена')
      // Reload order data
    } catch (error) {
      console.error('Failed to refresh label:', error)
      toast.error('Ошибка обновления этикетки')
    } finally {
      setLoadingLabel(false)
    }
  }

  return (
    <div className="space-y-6" data-testid="order-info-tab">
      {/* Основная информация */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-mm-text-secondary uppercase font-mono mb-2">// Номер заказа</p>
            <p className="text-mm-text font-mono">{order.order_number}</p>
          </div>
          
          <div>
            <p className="text-xs text-mm-text-secondary uppercase font-mono mb-2">// Маркетплейс</p>
            <p className="text-mm-cyan font-mono uppercase">{order.marketplace}</p>
          </div>
          
          <div>
            <p className="text-xs text-mm-text-secondary uppercase font-mono mb-2">// Статус</p>
            {getStatusBadge(order.status)}
          </div>
          
          <div>
            <p className="text-xs text-mm-text-secondary uppercase font-mono mb-2">// Дата создания</p>
            <p className="text-mm-text font-mono">{new Date(order.created_at).toLocaleString('ru-RU')}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-mm-text-secondary uppercase font-mono mb-2">// External ID</p>
            <p className="text-mm-text font-mono">{order.external_order_id}</p>
          </div>
          
          <div>
            <p className="text-xs text-mm-text-secondary uppercase font-mono mb-2">// Склад</p>
            <p className="text-mm-text font-mono">{order.warehouse_id}</p>
          </div>
          
          <div>
            <p className="text-xs text-mm-text-secondary uppercase font-mono mb-2">// Остаток обновлён</p>
            <p className="text-mm-text font-mono">{order.stock_updated ? 'Да' : 'Нет'}</p>
          </div>
        </div>
      </div>

      {/* Покупатель */}
      <div className="border-t border-mm-border pt-6">
        <h3 className="flex items-center space-x-2 text-sm uppercase font-mono text-mm-cyan mb-4">
          <FiUser />
          <span>Покупатель</span>
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-mm-text-secondary uppercase font-mono mb-2">// ФИО</p>
            <p className="text-mm-text font-mono">{order.customer?.full_name || 'Не указано'}</p>
          </div>
          <div>
            <p className="text-xs text-mm-text-secondary uppercase font-mono mb-2">// Телефон</p>
            <p className="text-mm-text font-mono">{order.customer?.phone || 'Не указано'}</p>
          </div>
          {order.customer?.address && (
            <div className="col-span-2">
              <p className="text-xs text-mm-text-secondary uppercase font-mono mb-2">// Адрес</p>
              <p className="text-mm-text font-mono">{order.customer.address}</p>
            </div>
          )}
        </div>
      </div>

      {/* Товары */}
      <div className="border-t border-mm-border pt-6">
        <h3 className="flex items-center space-x-2 text-sm uppercase font-mono text-mm-cyan mb-4">
          <FiPackage />
          <span>Состав заказа</span>
        </h3>
        <div className="border border-mm-border rounded overflow-hidden">
          <table className="w-full">
            <thead className="bg-mm-border/30">
              <tr>
                <th className="text-left py-3 px-4 text-xs text-mm-text-secondary uppercase font-mono">Артикул</th>
                <th className="text-left py-3 px-4 text-xs text-mm-text-secondary uppercase font-mono">Название</th>
                <th className="text-right py-3 px-4 text-xs text-mm-text-secondary uppercase font-mono">Кол-во</th>
                <th className="text-right py-3 px-4 text-xs text-mm-text-secondary uppercase font-mono">Цена</th>
                <th className="text-right py-3 px-4 text-xs text-mm-text-secondary uppercase font-mono">Итого</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item, idx) => (
                <tr key={idx} className="border-t border-mm-border">
                  <td className="py-3 px-4 font-mono text-sm text-mm-text">{item.article}</td>
                  <td className="py-3 px-4 font-mono text-sm text-mm-text">{item.name}</td>
                  <td className="py-3 px-4 font-mono text-sm text-mm-text text-right">{item.quantity}</td>
                  <td className="py-3 px-4 font-mono text-sm text-mm-text text-right">{item.price.toFixed(2)} ₽</td>
                  <td className="py-3 px-4 font-mono text-sm text-mm-cyan text-right">{item.total.toFixed(2)} ₽</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-mm-border/30 border-t border-mm-border">
              <tr>
                <td colSpan="4" className="py-3 px-4 text-sm font-mono text-mm-text-secondary text-right uppercase">Итого:</td>
                <td className="py-3 px-4 font-mono text-lg text-mm-cyan text-right font-bold">
                  {order.totals?.total?.toFixed(2) || '0.00'} ₽
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Этикетки и действия */}
      <div className="border-t border-mm-border pt-6">
        <h3 className="text-sm uppercase font-mono text-mm-cyan mb-4">// Этикетки и документы</h3>
        <div className="flex space-x-4">
          <button
            onClick={handlePrintLabel}
            disabled={loadingLabel}
            className="btn-neon flex items-center space-x-2"
            data-testid="print-label-btn"
          >
            <FiPrinter />
            <span>{loadingLabel ? 'Загрузка...' : 'ПЕЧАТЬ ЭТИКЕТКИ'}</span>
          </button>
          
          <button
            onClick={handleRefreshLabel}
            disabled={loadingLabel}
            className="px-4 py-2 font-mono text-sm border border-mm-border rounded hover:bg-mm-border transition-colors flex items-center space-x-2"
            data-testid="refresh-label-btn"
          >
            <FiRefreshCw className={loadingLabel ? 'animate-spin' : ''} />
            <span>ОБНОВИТЬ</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default OrderInfoTab
