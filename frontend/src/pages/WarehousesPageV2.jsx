import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import { FiPlus, FiEdit, FiTrash2, FiCheck, FiX } from 'react-icons/fi'
import { BsBoxSeam } from 'react-icons/bs'
import { toast } from 'sonner'

function WarehousesPageV2() {
  const { api } = useAuth()
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState(null)

  useEffect(() => {
    loadWarehouses()
  }, [])

  const loadWarehouses = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/warehouses')
      setWarehouses(response.data)
    } catch (error) {
      toast.error('Ошибка загрузки складов')
      console.error(error)
    }
    setLoading(false)
  }

  const handleDelete = async (wh) => {
    if (!confirm(`Удалить склад "${wh.name}"?`)) return
    
    try {
      await api.delete(`/api/warehouses/${wh.id}`)
      toast.success('Склад удалён')
      loadWarehouses()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка удаления')
    }
  }

  return (
    <div className="min-h-screen bg-mm-black text-mm-text p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-mm-cyan uppercase mb-2" data-testid="warehouses-title">Склады</h1>
            <p className="text-mm-text-secondary text-sm">// Управление складами и настройками</p>
          </div>
          <button
            onClick={() => {
              setEditingWarehouse(null)
              setShowModal(true)
            }}
            className="btn-primary flex items-center space-x-2"
            data-testid="create-warehouse-btn"
          >
            <FiPlus />
            <span>СОЗДАТЬ СКЛАД</span>
          </button>
        </div>

        {/* Warehouses Table */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-mm-cyan animate-pulse">// LOADING...</p>
          </div>
        ) : warehouses.length === 0 ? (
          <div className="card-neon text-center py-16" data-testid="empty-state">
            <BsBoxSeam className="mx-auto text-mm-text-tertiary mb-6" size={64} />
            <p className="text-mm-text-secondary text-lg mb-2">Нет складов</p>
            <p className="text-sm text-mm-text-tertiary mb-6">// Создайте первый склад для начала работы</p>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary"
            >
              <FiPlus className="inline mr-2" />
              СОЗДАТЬ СКЛАД
            </button>
          </div>
        ) : (
          <div className="card-neon overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-mm-border">
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Название</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Тип</th>
                  <th className="text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Приоритет</th>
                  <th className="text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Передача</th>
                  <th className="text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Заказы</th>
                  <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Действия</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((wh) => (
                  <tr key={wh.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors" data-testid={`warehouse-row-${wh.id}`}>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <BsBoxSeam className="text-mm-cyan" size={20} />
                        <div>
                          <div className="font-semibold">{wh.name}</div>
                          {wh.address && <div className="text-xs text-mm-text-tertiary">{wh.address}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 text-xs font-mono uppercase rounded ${
                        wh.type === 'main' ? 'bg-mm-cyan/20 text-mm-cyan border border-mm-cyan' :
                        wh.type === 'marketplace' ? 'bg-mm-purple/20 text-mm-purple border border-mm-purple' :
                        'bg-mm-yellow/20 text-mm-yellow border border-mm-yellow'
                      }`}>
                        {wh.type}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-mm-cyan font-mono font-bold">{wh.priority || 1}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      {wh.transfer_stock ? (
                        <FiCheck className="inline text-mm-green" size={20} />
                      ) : (
                        <FiX className="inline text-mm-red" size={20} />
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {wh.use_for_orders ? (
                        <FiCheck className="inline text-mm-green" size={20} />
                      ) : (
                        <FiX className="inline text-mm-red" size={20} />
                      )}
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingWarehouse(wh)
                          setShowModal(true)
                        }}
                        className="px-3 py-2 border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 transition-colors"
                        data-testid={`edit-warehouse-${wh.id}`}
                      >
                        <FiEdit size={16} />
                      </button>
                      {wh.type !== 'main' && (
                        <button
                          onClick={() => handleDelete(wh)}
                          className="px-3 py-2 border border-mm-red text-mm-red hover:bg-mm-red/10 transition-colors"
                          data-testid={`delete-warehouse-${wh.id}`}
                        >
                          <FiTrash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <WarehouseModal
            warehouse={editingWarehouse}
            onClose={() => {
              setShowModal(false)
              setEditingWarehouse(null)
            }}
            onSuccess={() => {
              setShowModal(false)
              setEditingWarehouse(null)
              loadWarehouses()
            }}
          />
        )}
      </div>
    </div>
  )
}

function WarehouseModal({ warehouse, onClose, onSuccess }) {
  const { api } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    type: 'main',
    address: '',
    comment: '',
    transfer_stock: true,
    load_orders: true,
    use_for_orders: true,
    priority: 1,
    fbo_accounting: false
  })
  
  // NEW: Links management
  const [links, setLinks] = useState([])
  const [integrations, setIntegrations] = useState([])
  const [selectedMarketplace, setSelectedMarketplace] = useState('')
  const [mpWarehouses, setMpWarehouses] = useState([])
  const [loadingMPWarehouses, setLoadingMPWarehouses] = useState(false)

  useEffect(() => {
    if (warehouse) {
      setFormData({
        name: warehouse.name || '',
        type: warehouse.type || 'main',
        address: warehouse.address || '',
        comment: warehouse.comment || '',
        transfer_stock: warehouse.transfer_stock !== false,
        load_orders: warehouse.load_orders !== false,
        use_for_orders: warehouse.use_for_orders !== false,
        priority: warehouse.priority || 1,
        fbo_accounting: warehouse.fbo_accounting || false
      })
      
      // Load links and integrations
      loadLinks()
      loadIntegrations()
    }
  }, [warehouse])
  
  const loadLinks = async () => {
    if (!warehouse) return
    try {
      const response = await api.get(`/api/warehouse-links/${warehouse.id}/links`)
      setLinks(response.data)
    } catch (error) {
      console.error('Failed to load links:', error)
    }
  }
  
  const loadIntegrations = async () => {
    try {
      const response = await api.get('/api/seller/api-keys')
      setIntegrations(response.data)
    } catch (error) {
      console.error('Failed to load integrations:', error)
    }
  }
  
  const loadMPWarehouses = async () => {
    if (!selectedMarketplace) {
      toast.error('Выберите маркетплейс')
      return
    }
    
    setLoadingMPWarehouses(true)
    try {
      const response = await api.get(`/api/marketplace/${selectedMarketplace}/warehouses`)
      setMpWarehouses(response.data.warehouses || [])
      
      if (response.data.warehouses?.length === 0) {
        toast.error('Не найдено FBS складов на маркетплейсе')
      } else {
        toast.success(`Найдено ${response.data.warehouses.length} складов`)
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка загрузки складов')
      setMpWarehouses([])
    }
    setLoadingMPWarehouses(false)
  }
  
  const addLink = async (mpWarehouse) => {
    if (!warehouse) return
    
    try {
      const integration = integrations.find(i => i.marketplace === selectedMarketplace)
      
      await api.post(`/api/warehouse-links/${warehouse.id}/links`, {
        integration_id: integration.id,
        marketplace_name: selectedMarketplace,
        marketplace_warehouse_id: mpWarehouse.id,
        marketplace_warehouse_name: mpWarehouse.name
      })
      
      toast.success('Связь создана')
      loadLinks()
      setMpWarehouses([])
      setSelectedMarketplace('')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка создания связи')
    }
  }
  
  const deleteLink = async (linkId) => {
    if (!confirm('Удалить связь?')) return
    
    try {
      await api.delete(`/api/warehouse-links/${warehouse.id}/links/${linkId}`)
      toast.success('Связь удалена')
      loadLinks()
    } catch (error) {
      toast.error('Ошибка удаления связи')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      if (warehouse) {
        await api.put(`/api/warehouses/${warehouse.id}`, formData)
        toast.success('Склад обновлён')
      } else {
        await api.post('/api/warehouses', formData)
        toast.success('Склад создан')
      }
      onSuccess()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка сохранения')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50" data-testid="warehouse-modal">
      <div className="card-neon max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl text-mm-cyan uppercase">
            {warehouse ? 'Редактировать склад' : 'Создать склад'}
          </h3>
          <button onClick={onClose} className="text-mm-text-secondary hover:text-mm-red transition-colors">
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Название склада *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="input-neon w-full"
              placeholder="Основной склад Москва"
              required
              data-testid="warehouse-name-input"
            />
          </div>

          {!warehouse && (
            <div>
              <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Тип склада *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="input-neon w-full"
                data-testid="warehouse-type-select"
              >
                <option value="main">Основной</option>
                <option value="marketplace">Маркетплейс</option>
                <option value="transit">Транзитный</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Адрес</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="input-neon w-full"
              placeholder="г. Москва, ул. Складская, 10"
              data-testid="warehouse-address-input"
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Комментарий</label>
            <textarea
              value={formData.comment}
              onChange={(e) => setFormData({...formData, comment: e.target.value})}
              className="input-neon w-full"
              rows="3"
              placeholder="Дополнительная информация"
              data-testid="warehouse-comment-input"
            />
          </div>

          {/* Settings */}
          <div className="border-t border-mm-border pt-6">
            <h4 className="text-mm-cyan uppercase text-sm mb-4">// Настройки склада</h4>
            
            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 border border-mm-border hover:border-mm-cyan transition-colors cursor-pointer">
                <div>
                  <div className="font-semibold text-mm-text">Передавать остатки на маркетплейсы</div>
                  <div className="text-xs text-mm-text-tertiary">Автоматическая синхронизация остатков</div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.transfer_stock}
                  onChange={(e) => setFormData({...formData, transfer_stock: e.target.checked})}
                  className="toggle-switch"
                  data-testid="transfer-stock-toggle"
                />
              </label>

              <label className="flex items-center justify-between p-3 border border-mm-border hover:border-mm-cyan transition-colors cursor-pointer">
                <div>
                  <div className="font-semibold text-mm-text">Загружать заказы</div>
                  <div className="text-xs text-mm-text-tertiary">Импорт заказов с маркетплейсов</div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.load_orders}
                  onChange={(e) => setFormData({...formData, load_orders: e.target.checked})}
                  className="toggle-switch"
                  data-testid="load-orders-toggle"
                />
              </label>

              <label className="flex items-center justify-between p-3 border border-mm-border hover:border-mm-cyan transition-colors cursor-pointer">
                <div>
                  <div className="font-semibold text-mm-text">Использовать для заказов</div>
                  <div className="text-xs text-mm-text-tertiary">Резервирование остатков при заказе</div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.use_for_orders}
                  onChange={(e) => setFormData({...formData, use_for_orders: e.target.checked})}
                  className="toggle-switch"
                  data-testid="use-for-orders-toggle"
                />
              </label>

              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Приоритет списания</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value) || 1})}
                  className="input-neon w-32"
                  data-testid="priority-input"
                />
                <p className="text-xs text-mm-text-tertiary mt-1">// Меньше = выше приоритет (1, 2, 3...)</p>
              </div>

              <label className="flex items-center justify-between p-3 border border-mm-border hover:border-mm-cyan transition-colors cursor-pointer">
                <div>
                  <div className="font-semibold text-mm-text">Учёт FBO</div>
                  <div className="text-xs text-mm-text-tertiary">Для аналитики закупок FBO (FIFO)</div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.fbo_accounting}
                  onChange={(e) => setFormData({...formData, fbo_accounting: e.target.checked})}
                  className="toggle-switch"
                  data-testid="fbo-accounting-toggle"
                />
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              data-testid="cancel-btn"
            >
              ОТМЕНА
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              data-testid="submit-btn"
            >
              {warehouse ? 'СОХРАНИТЬ' : 'СОЗДАТЬ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default WarehousesPageV2
