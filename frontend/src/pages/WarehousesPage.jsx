import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiTrash2, FiEdit, FiPlus, FiLink, FiX } from 'react-icons/fi'
import { BsBoxSeam } from 'react-icons/bs'

function WarehousesPage() {
  const { api } = useAuth()
  const [warehouses, setWarehouses] = useState([])
  const [integrations, setIntegrations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState(null)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState(null)
  const [selectedIntegration, setSelectedIntegration] = useState('')
  const [mpWarehouses, setMpWarehouses] = useState([])
  const [loadingMPWarehouses, setLoadingMPWarehouses] = useState(false)

  useEffect(() => {
    loadWarehouses()
    loadIntegrations()
  }, [])

  const loadWarehouses = async () => {
    setIsLoading(true)
    try {
      const response = await api.get('/api/warehouses')
      setWarehouses(response.data)
    } catch (error) {
      console.error('Failed to load warehouses:', error)
      alert('❌ Ошибка загрузки складов: ' + (error.response?.data?.detail || error.message))
    }
    setIsLoading(false)
  }

  const loadIntegrations = async () => {
    try {
      const response = await api.get('/api/seller/api-keys')
      setIntegrations(response.data || [])
    } catch (error) {
      console.error('Failed to load integrations:', error)
    }
  }

  const loadWarehouseLinks = async (warehouseId) => {
    try {
      const response = await api.get(`/api/warehouses/${warehouseId}/links`)
      return response.data || []
    } catch (error) {
      console.error('Failed to load links:', error)
      return []
    }
  }

  const loadWarehouseStock = async (warehouseId) => {
    try {
      const response = await api.get(`/api/warehouses/${warehouseId}/stock`)
      return response.data || { items: [], total_items: 0 }
    } catch (error) {
      console.error('Failed to load stock:', error)
      return { items: [], total_items: 0 }
    }
  }

  const handleSaveWarehouse = async (data) => {
    try {
      if (editingWarehouse) {
        await api.put(`/api/warehouses/${editingWarehouse.id}`, data)
        alert('✅ Склад обновлён!')
      } else {
        await api.post('/api/warehouses', data)
        alert('✅ Склад создан!')
      }
      
      setIsModalOpen(false)
      setEditingWarehouse(null)
      await loadWarehouses()
      
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleDelete = async (warehouse) => {
    if (!confirm(`Удалить склад "${warehouse.name}"?`)) return
    
    try {
      await api.delete(`/api/warehouses/${warehouse.id}`)
      alert('✅ Склад удалён!')
      await loadWarehouses()
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleOpenLinkModal = async (warehouse) => {
    console.log('Opening link modal for warehouse:', warehouse)
    if (!warehouse || !warehouse.id) {
      console.error('Invalid warehouse object:', warehouse)
      alert('❌ Ошибка: неверный объект склада')
      return
    }
    setSelectedWarehouse(warehouse)
    setSelectedIntegration('')
    setMpWarehouses([])
    setShowLinkModal(true)
  }

  const handleLoadMPWarehouses = async () => {
    if (!selectedIntegration) {
      alert('Выберите интеграцию!')
      return
    }
    
    // Находим интеграцию чтобы получить название маркетплейса
    const integration = integrations.find(i => i.id === selectedIntegration)
    if (!integration || !integration.marketplace) {
      alert('❌ Не удалось определить маркетплейс для выбранной интеграции')
      return
    }
    
    // Преобразуем название маркетплейса в формат API (ozon, wb, yandex)
    const marketplace = integration.marketplace.toLowerCase()
    const marketplaceMap = {
      'wildberries': 'wb',
      'ozon': 'ozon',
      'yandex': 'yandex'
    }
    const apiMarketplace = marketplaceMap[marketplace] || marketplace
    
    setLoadingMPWarehouses(true)
    try {
      const response = await api.get(`/api/marketplace/${apiMarketplace}/warehouses`)
      setMpWarehouses(response.data.warehouses || [])
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    }
    setLoadingMPWarehouses(false)
  }

  const handleLinkWarehouse = async (mpWarehouse) => {
    console.log('🔗 handleLinkWarehouse called with:', {
      mpWarehouse,
      selectedWarehouse,
      selectedIntegration
    })
    
    if (!selectedWarehouse) {
      console.error('❌ selectedWarehouse is missing!')
      alert('❌ Ошибка: склад не выбран')
      return
    }
    
    if (!selectedWarehouse.id) {
      console.error('❌ selectedWarehouse.id is missing!', selectedWarehouse)
      alert('❌ Ошибка: у склада отсутствует ID')
      return
    }
    
    if (!selectedIntegration) {
      console.error('❌ selectedIntegration is missing!')
      alert('❌ Ошибка: интеграция не выбрана')
      return
    }
    
    const integration = integrations.find(i => i.id === selectedIntegration)
    if (!integration) {
      console.error('❌ Integration not found', { selectedIntegration, integrations })
      alert('❌ Интеграция не найдена')
      return
    }
    
    if (!integration.marketplace) {
      console.error('❌ Integration marketplace is missing', integration)
      alert('❌ У интеграции отсутствует название маркетплейса')
      return
    }
    
    if (!mpWarehouse || !mpWarehouse.id) {
      console.error('❌ mpWarehouse is invalid', mpWarehouse)
      alert('❌ Неверный склад маркетплейса')
      return
    }
    
    console.log('✅ All checks passed. Creating link:', {
      warehouseId: selectedWarehouse.id,
      warehouseName: selectedWarehouse.name,
      integrationId: selectedIntegration,
      marketplace: integration.marketplace,
      mpWarehouseId: mpWarehouse.id,
      mpWarehouseName: mpWarehouse.name
    })
    
    try {
      const requestData = {
        integration_id: selectedIntegration,
        marketplace_name: integration.marketplace.toLowerCase(),
        marketplace_warehouse_id: String(mpWarehouse.id),
        marketplace_warehouse_name: mpWarehouse.name || String(mpWarehouse.id)
      }
      
      console.log('📤 Sending POST request to:', `/api/warehouses/${selectedWarehouse.id}/links`)
      console.log('📤 Request data:', requestData)
      
      const response = await api.post(`/api/warehouses/${selectedWarehouse.id}/links`, requestData)
      
      console.log('✅ Link created successfully:', response.data)
      alert('✅ Склад маркетплейса привязан!')
      setShowLinkModal(false)
      setSelectedWarehouse(null)
      setSelectedIntegration('')
      setMpWarehouses([])
      await loadWarehouses()
    } catch (error) {
      console.error('❌ Error linking warehouse:', error)
      console.error('❌ Error response:', error.response)
      const errorMessage = error.response?.data?.detail || error.message || 'Неизвестная ошибка'
      alert('❌ Ошибка: ' + errorMessage)
    }
  }

  const handleDeleteLink = async (warehouseId, linkId) => {
    if (!confirm('Удалить связь со складом маркетплейса?')) return
    
    try {
      await api.delete(`/api/warehouses/${warehouseId}/links/${linkId}`)
      alert('✅ Связь удалена!')
      await loadWarehouses()
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const mainWarehouses = warehouses.filter(w => w.type === 'main')
  const otherWarehouses = warehouses.filter(w => w.type !== 'main')

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-mm-cyan animate-pulse">// ЗАГРУЗКА...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl mb-2 text-mm-cyan uppercase">СКЛАДЫ</h2>
          <p className="comment">// Управление складами и сопоставление с маркетплейсами</p>
        </div>
        <button 
          onClick={() => {
            setEditingWarehouse(null)
            setIsModalOpen(true)
          }}
          className="btn-primary"
        >
          <FiPlus className="inline mr-2" />
          СОЗДАТЬ СКЛАД
        </button>
      </div>

      {/* Информационный блок */}
      <div className="card-neon bg-mm-darker border-mm-cyan/30">
        <div className="flex items-start space-x-4">
          <BsBoxSeam className="text-mm-cyan text-2xl mt-1" />
          <div>
            <h3 className="text-mm-cyan font-semibold mb-2">Как это работает?</h3>
            <p className="text-mm-text-secondary text-sm leading-relaxed">
              <strong>Основной склад</strong> — это ваш физический склад, где реально лежат товары.<br/>
              <strong>Склады маркетплейсов</strong> — это FBS/realFBS склады на Ozon, WB, Яндекс, которые вы получаете через API.<br/>
              <strong>Сопоставление</strong> — связывайте основной склад со складами маркетплейсов. При изменении остатка на основном складе, новое значение автоматически отправляется на все связанные маркетплейсы.
            </p>
          </div>
        </div>
      </div>

      {/* Основные склады */}
      {mainWarehouses.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg text-mm-cyan uppercase">Основные склады</h3>
          {mainWarehouses.map(warehouse => (
            <WarehouseCard
              key={warehouse.id}
              warehouse={warehouse}
              integrations={integrations}
              onEdit={() => {
                setEditingWarehouse(warehouse)
                setIsModalOpen(true)
              }}
              onDelete={handleDelete}
              onLink={() => handleOpenLinkModal(warehouse)}
              onDeleteLink={handleDeleteLink}
              loadLinks={loadWarehouseLinks}
              loadStock={loadWarehouseStock}
            />
          ))}
        </div>
      )}

      {/* Другие склады */}
      {otherWarehouses.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg text-mm-cyan uppercase">Другие склады</h3>
          {otherWarehouses.map(warehouse => (
            <WarehouseCard
              key={warehouse.id}
              warehouse={warehouse}
              integrations={integrations}
              onEdit={() => {
                setEditingWarehouse(warehouse)
                setIsModalOpen(true)
              }}
              onDelete={handleDelete}
              onLink={() => handleOpenLinkModal(warehouse)}
              onDeleteLink={handleDeleteLink}
              loadLinks={loadWarehouseLinks}
              loadStock={loadWarehouseStock}
            />
          ))}
        </div>
      )}

      {/* Пустое состояние */}
      {warehouses.length === 0 && (
        <div className="card-neon text-center py-16">
          <BsBoxSeam className="mx-auto text-mm-text-tertiary mb-6" size={64} />
          <p className="text-mm-text-secondary text-lg mb-6">У вас пока нет ни одного склада...</p>
          <button 
            onClick={() => {
              setEditingWarehouse(null)
              setIsModalOpen(true)
            }}
            className="btn-primary"
          >
            <FiPlus className="inline mr-2" />
            СОЗДАТЬ ОСНОВНОЙ СКЛАД
          </button>
        </div>
      )}

      {/* Модалка создания/редактирования склада */}
      {isModalOpen && (
        <WarehouseModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setEditingWarehouse(null)
          }}
          onSave={handleSaveWarehouse}
          editingWarehouse={editingWarehouse}
          existingWarehouses={warehouses}
        />
      )}

      {/* Модалка привязки склада МП */}
      {showLinkModal && selectedWarehouse && (
        <LinkMPWarehouseModal
          isOpen={showLinkModal}
          onClose={() => {
            setShowLinkModal(false)
            setSelectedWarehouse(null)
            setSelectedIntegration('')
            setMpWarehouses([])
          }}
          warehouse={selectedWarehouse}
          integrations={integrations}
          selectedIntegration={selectedIntegration}
          setSelectedIntegration={setSelectedIntegration}
          mpWarehouses={mpWarehouses}
          loadingMPWarehouses={loadingMPWarehouses}
          onLoadWarehouses={handleLoadMPWarehouses}
          onLink={handleLinkWarehouse}
        />
      )}
    </div>
  )
}

// Компонент карточки склада
function WarehouseCard({ warehouse, integrations, onEdit, onDelete, onLink, onDeleteLink, loadLinks, loadStock }) {
  const [links, setLinks] = useState([])
  const [stock, setStock] = useState({ items: [], total_items: 0 })
  const [loadingLinks, setLoadingLinks] = useState(true)
  const [loadingStock, setLoadingStock] = useState(true)

  useEffect(() => {
    loadData()
  }, [warehouse.id])

  const loadData = async () => {
    setLoadingLinks(true)
    setLoadingStock(true)
    
    const [linksData, stockData] = await Promise.all([
      loadLinks(warehouse.id),
      loadStock(warehouse.id)
    ])
    
    setLinks(linksData)
    setStock(stockData)
    setLoadingLinks(false)
    setLoadingStock(false)
  }

  const settings = warehouse.settings || {}
  const totalQuantity = stock.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
  const totalReserved = stock.items.reduce((sum, item) => sum + (item.reserved || 0), 0)
  const totalAvailable = totalQuantity - totalReserved

  return (
    <div className="card-neon">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <BsBoxSeam className="text-mm-cyan" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-mm-cyan">{warehouse.name}</h3>
              <p className="text-sm text-mm-text-secondary">{warehouse.address || 'Адрес не указан'}</p>
            </div>
            {warehouse.type === 'main' && (
              <span className="px-3 py-1 text-xs font-mono uppercase bg-mm-cyan/20 text-mm-cyan border border-mm-cyan">
                ОСНОВНОЙ
              </span>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          {warehouse.type === 'main' && (
            <button
              onClick={onLink}
              className="px-3 py-2 border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 transition-colors"
              title="Привязать склад МП"
            >
              <FiLink size={16} />
            </button>
          )}
          <button
            onClick={onEdit}
            className="px-3 py-2 border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 transition-colors"
            title="Редактировать"
          >
            <FiEdit size={16} />
          </button>
          {warehouse.type !== 'main' && (
            <button
              onClick={() => onDelete(warehouse)}
              className="px-3 py-2 border border-mm-red text-mm-red hover:bg-mm-red/10 transition-colors"
              title="Удалить"
            >
              <FiTrash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-mm-darker p-3 rounded">
          <div className="text-xs text-mm-text-secondary uppercase mb-1">Товаров</div>
          <div className="text-lg font-semibold text-mm-cyan">{stock.total_items}</div>
        </div>
        <div className="bg-mm-darker p-3 rounded">
          <div className="text-xs text-mm-text-secondary uppercase mb-1">Остаток</div>
          <div className="text-lg font-semibold text-mm-cyan">{totalQuantity}</div>
        </div>
        <div className="bg-mm-darker p-3 rounded">
          <div className="text-xs text-mm-text-secondary uppercase mb-1">В резерве</div>
          <div className="text-lg font-semibold text-mm-yellow">{totalReserved}</div>
        </div>
      </div>

      {/* Настройки */}
      <div className="mb-4 text-sm">
        <div className="text-mm-text-secondary mb-2">Настройки:</div>
        <div className="flex flex-wrap gap-2">
          <span className={`px-2 py-1 rounded ${settings.transfer_stock ? 'bg-mm-cyan/20 text-mm-cyan' : 'bg-mm-gray text-mm-text-secondary'}`}>
            Передавать остатки: {settings.transfer_stock ? 'Да' : 'Нет'}
          </span>
          <span className={`px-2 py-1 rounded ${settings.load_orders ? 'bg-mm-cyan/20 text-mm-cyan' : 'bg-mm-gray text-mm-text-secondary'}`}>
            Загружать заказы: {settings.load_orders ? 'Да' : 'Нет'}
          </span>
          <span className={`px-2 py-1 rounded ${settings.use_for_orders ? 'bg-mm-cyan/20 text-mm-cyan' : 'bg-mm-gray text-mm-text-secondary'}`}>
            Использовать для заказов: {settings.use_for_orders ? 'Да' : 'Нет'}
          </span>
        </div>
      </div>

      {/* Связанные склады МП */}
      {warehouse.type === 'main' && (
        <div className="border-t border-mm-border pt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-mm-text-secondary">Связанные склады маркетплейсов:</div>
            <button
              onClick={onLink}
              className="text-xs text-mm-cyan hover:text-mm-cyan/80"
            >
              + Привязать
            </button>
          </div>
          {loadingLinks ? (
            <div className="text-sm text-mm-text-tertiary">Загрузка...</div>
          ) : links.length === 0 ? (
            <div className="text-sm text-mm-text-tertiary">Нет привязанных складов</div>
          ) : (
            <div className="space-y-2">
              {links.map(link => (
                <div key={link.id} className="flex items-center justify-between bg-mm-darker p-2 rounded">
                  <div>
                    <div className="text-sm font-semibold">{link.marketplace_warehouse_name}</div>
                    <div className="text-xs text-mm-text-secondary">
                      {link.marketplace_name?.toUpperCase()} • ID: {link.marketplace_warehouse_id}
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteLink(warehouse.id, link.id)}
                    className="text-mm-red hover:text-mm-red/80"
                    title="Удалить связь"
                  >
                    <FiX size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Модалка создания/редактирования склада
function WarehouseModal({ isOpen, onClose, onSave, editingWarehouse, existingWarehouses }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('main')
  const [address, setAddress] = useState('')
  const [transferStock, setTransferStock] = useState(true)
  const [loadOrders, setLoadOrders] = useState(true)
  const [useForOrders, setUseForOrders] = useState(true)

  useEffect(() => {
    if (editingWarehouse) {
      setName(editingWarehouse.name || '')
      setType(editingWarehouse.type || 'main')
      setAddress(editingWarehouse.address || '')
      const settings = editingWarehouse.settings || {}
      setTransferStock(settings.transfer_stock !== false)
      setLoadOrders(settings.load_orders !== false)
      setUseForOrders(settings.use_for_orders !== false)
    } else {
      setName('')
      setType('main')
      setAddress('')
      setTransferStock(true)
      setLoadOrders(true)
      setUseForOrders(true)
    }
  }, [editingWarehouse, isOpen])

  const hasMainWarehouse = existingWarehouses.some(w => w.type === 'main')
  const isEditing = !!editingWarehouse

  const handleSubmit = (e) => {
    e.preventDefault()
    const data = {
      name,
      type: isEditing ? undefined : type,
      address,
      settings: {
        transfer_stock: transferStock,
        load_orders: loadOrders,
        use_for_orders: useForOrders
      }
    }
    onSave(data)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
      <div className="card-neon max-w-2xl w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl text-mm-cyan">{isEditing ? 'РЕДАКТИРОВАТЬ СКЛАД' : 'СОЗДАТЬ СКЛАД'}</h3>
          <button onClick={onClose} className="text-mm-text-secondary hover:text-mm-red">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Название склада *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-neon w-full"
              placeholder="Например: Основной склад"
              required
            />
          </div>

          {!isEditing && (
            <div>
              <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Тип склада *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input-neon w-full"
                disabled={!hasMainWarehouse}
              >
                <option value="main">Основной</option>
                {hasMainWarehouse && <option value="marketplace">Маркетплейс</option>}
                {hasMainWarehouse && <option value="transit">Транзитный</option>}
              </select>
              <p className="comment text-xs mt-1">
                {!hasMainWarehouse ? '// Первый склад должен быть Основным' : '// Основной склад уже создан'}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Адрес</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input-neon w-full"
              placeholder="г. Москва, ул. Ленина, 1"
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Настройки</label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={transferStock}
                  onChange={(e) => setTransferStock(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Передавать остатки на маркетплейсы</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={loadOrders}
                  onChange={(e) => setLoadOrders(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Загружать заказы</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={useForOrders}
                  onChange={(e) => setUseForOrders(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Использовать для FBS заказов</span>
              </label>
            </div>
          </div>

          <div className="flex space-x-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">ОТМЕНА</button>
            <button type="submit" disabled={!name} className="btn-primary flex-1 disabled:opacity-50">
              {isEditing ? 'СОХРАНИТЬ' : 'СОЗДАТЬ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Модалка привязки склада МП
function LinkMPWarehouseModal({
  isOpen,
  onClose,
  warehouse,
  integrations,
  selectedIntegration,
  setSelectedIntegration,
  mpWarehouses,
  loadingMPWarehouses,
  onLoadWarehouses,
  onLink
}) {
  if (!isOpen) return null
  
  // Проверка что warehouse передан
  if (!warehouse) {
    console.error('❌ LinkMPWarehouseModal: warehouse is missing!')
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
        <div className="card-neon max-w-3xl w-full">
          <div className="text-center p-6">
            <p className="text-mm-red">❌ Ошибка: склад не передан в модальное окно</p>
            <button onClick={onClose} className="btn-secondary mt-4">ЗАКРЫТЬ</button>
          </div>
        </div>
      </div>
    )
  }
  
  console.log('🔍 LinkMPWarehouseModal rendered with warehouse:', warehouse)

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
      <div className="card-neon max-w-3xl w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl text-mm-cyan">ПРИВЯЗАТЬ СКЛАД МАРКЕТПЛЕЙСА</h3>
          <button onClick={onClose} className="text-mm-text-secondary hover:text-mm-red">✕</button>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-sm text-mm-text-secondary mb-4">
              Склад: <strong className="text-mm-cyan">{warehouse.name || 'Не указано'}</strong>
              {warehouse.id && <span className="text-xs text-mm-text-tertiary ml-2">(ID: {warehouse.id})</span>}
            </p>
          </div>

          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Выберите интеграцию</label>
            <select
              value={selectedIntegration}
              onChange={(e) => setSelectedIntegration(e.target.value)}
              className="input-neon w-full"
            >
              <option value="">Выберите интеграцию...</option>
              {integrations.map(int => (
                <option key={int.id} value={int.id}>
                  {int.marketplace?.toUpperCase() || 'UNKNOWN'} - {int.name || 'Интеграция'}
                </option>
              ))}
            </select>
            <p className="comment text-xs mt-1">// Настраиваются во вкладке API KEYS</p>
          </div>

          <button
            onClick={onLoadWarehouses}
            disabled={!selectedIntegration || loadingMPWarehouses}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loadingMPWarehouses ? 'ЗАГРУЗКА...' : 'ЗАГРУЗИТЬ СКЛАДЫ С МП'}
          </button>

          {mpWarehouses.length > 0 && (
            <div className="border-t border-mm-border pt-4">
              <div className="text-sm text-mm-text-secondary mb-3">Доступные склады:</div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {mpWarehouses.map(wh => (
                  <div
                    key={wh.id}
                    className="flex items-center justify-between bg-mm-darker p-3 rounded hover:bg-mm-gray transition-colors cursor-pointer"
                    onClick={() => {
                      console.log('🖱️ Clicked on MP warehouse:', wh)
                      console.log('🖱️ Current warehouse prop:', warehouse)
                      if (!warehouse || !warehouse.id) {
                        console.error('❌ Cannot link: warehouse prop is invalid', warehouse)
                        alert('❌ Ошибка: основной склад не выбран')
                        return
                      }
                      onLink(wh)
                    }}
                  >
                    <div>
                      <div className="font-semibold">{wh.name || 'Без названия'}</div>
                      <div className="text-xs text-mm-text-secondary">
                        ID: {wh.id} • Тип: {wh.type || 'N/A'}
                      </div>
                    </div>
                    <button 
                      className="text-mm-cyan hover:text-mm-cyan/80"
                      onClick={(e) => {
                        e.stopPropagation()
                        console.log('🖱️ Button clicked for MP warehouse:', wh)
                        if (!warehouse || !warehouse.id) {
                          console.error('❌ Cannot link: warehouse prop is invalid', warehouse)
                          alert('❌ Ошибка: основной склад не выбран')
                          return
                        }
                        onLink(wh)
                      }}
                    >
                      <FiLink size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-4">
            <button onClick={onClose} className="btn-secondary flex-1">ОТМЕНА</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WarehousesPage
