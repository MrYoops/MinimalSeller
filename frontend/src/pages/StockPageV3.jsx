import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiDownload, FiRefreshCw, FiSearch, FiUpload, FiCheck, FiX, FiEdit2, FiFilter, FiArrowUp, FiArrowDown } from 'react-icons/fi'
import { toast } from 'sonner'

function StockPageV3() {
  const { api } = useAuth()
  const [stocks, setStocks] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [selectedWarehouse, setSelectedWarehouse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [editValue, setEditValue] = useState('')
  
  // Состояния для фильтров и поиска
  const [searchQuery, setSearchQuery] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('all') // 'all' | 'in_stock' | 'out_of_stock'
  const [sortConfig, setSortConfig] = useState({ field: 'sku', direction: 'asc' })
  const [showCriticalOnly, setShowCriticalOnly] = useState(false)
  const [showReservedOnly, setShowReservedOnly] = useState(false)
  
  // Состояния для импорта остатков
  const [showImportModal, setShowImportModal] = useState(false)
  const [integrations, setIntegrations] = useState([])
  const [selectedIntegration, setSelectedIntegration] = useState(null)
  const [mpWarehouses, setMpWarehouses] = useState([])
  const [selectedMpWarehouse, setSelectedMpWarehouse] = useState(null)
  const [importing, setImporting] = useState(false)

  // Фильтрация и сортировка остатков
  const filteredAndSortedStocks = useMemo(() => {
    let result = [...stocks]
    
    // Поиск по SKU и названию
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(item => 
        item.sku.toLowerCase().includes(query) ||
        (item.product_name && item.product_name.toLowerCase().includes(query))
      )
    }
    
    // Фильтр наличия
    if (availabilityFilter === 'in_stock') {
      result = result.filter(item => item.quantity > 0)
    } else if (availabilityFilter === 'out_of_stock') {
      result = result.filter(item => item.quantity === 0)
    }
    
    // Критический остаток
    if (showCriticalOnly) {
      result = result.filter(item => item.quantity < item.alert_threshold)
    }
    
    // Зарезервировано
    if (showReservedOnly) {
      result = result.filter(item => item.reserved > 0)
    }
    
    // Сортировка
    result.sort((a, b) => {
      let aVal, bVal
      
      if (sortConfig.field === 'name') {
        aVal = a.product_name || ''
        bVal = b.product_name || ''
      } else if (sortConfig.field === 'sku') {
        aVal = a.sku || ''
        bVal = b.sku || ''
      } else if (sortConfig.field === 'quantity') {
        aVal = a.quantity || 0
        bVal = b.quantity || 0
      }
      
      if (sortConfig.direction === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })
    
    return result
  }, [stocks, searchQuery, availabilityFilter, sortConfig, showCriticalOnly, showReservedOnly])
  
  // Сброс всех фильтров
  const resetFilters = () => {
    setSearchQuery('')
    setAvailabilityFilter('all')
    setSortConfig({ field: 'sku', direction: 'asc' })
    setShowCriticalOnly(false)
    setShowReservedOnly(false)
  }
  
  // Переключение направления сортировки
  const toggleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  useEffect(() => {
    const init = async () => {
      await loadWarehouses()
      await syncInventory() // Wait for sync
      if (selectedWarehouse) {
        await loadStocks() // Then load stocks
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (selectedWarehouse) {
      loadStocks()
    }
  }, [selectedWarehouse])

  const loadWarehouses = async () => {
    try {
      const response = await api.get('/api/warehouses')
      const warehousesData = response.data
      setWarehouses(warehousesData)
      
      // Попытаться загрузить сохранённый выбор
      const savedWarehouseId = localStorage.getItem('selectedWarehouseId')
      
      if (savedWarehouseId) {
        const savedWarehouse = warehousesData.find(wh => wh.id === savedWarehouseId)
        if (savedWarehouse) {
          setSelectedWarehouse(savedWarehouse)
        } else if (warehousesData.length > 0) {
          setSelectedWarehouse(warehousesData[0])
        }
      } else if (warehousesData.length > 0) {
        // Выбрать первый склад по умолчанию
        setSelectedWarehouse(warehousesData[0])
      }
    } catch (error) {
      toast.error('Ошибка загрузки складов')
      console.error(error)
    }
  }

  const loadStocks = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/inventory/fbs')
      setStocks(response.data)
    } catch (error) {
      toast.error('Ошибка загрузки остатков')
      console.error(error)
    }
    setLoading(false)
  }

  const syncInventory = async () => {
    try {
      const response = await api.post('/api/inventory/sync-catalog')
      console.log('Inventory synced:', response.data)
      return response.data
    } catch (error) {
      console.error('Failed to sync inventory:', error)
      return null
    }
  }

  const handleWarehouseChange = (warehouseId) => {
    const warehouse = warehouses.find(wh => wh.id === warehouseId)
    if (warehouse) {
      setSelectedWarehouse(warehouse)
      localStorage.setItem('selectedWarehouseId', warehouseId)
    }
  }

  const startEdit = (stock) => {
    setEditingRow(stock.id)
    setEditValue(stock.quantity.toString())
  }

  const cancelEdit = () => {
    setEditingRow(null)
    setEditValue('')
  }

  const saveStock = async (stock) => {
    const newQuantity = parseInt(editValue, 10)
    
    console.log('[SAVE STOCK] Начало сохранения:', {
      stock_id: stock.id,
      product_id: stock.product_id,
      sku: stock.sku,
      editValue: editValue,
      parsedQuantity: newQuantity,
      selectedWarehouse: selectedWarehouse
    })
    
    if (isNaN(newQuantity) || newQuantity < 0) {
      console.error('[SAVE STOCK] ❌ Некорректное значение:', newQuantity)
      toast.error('Некорректное значение')
      return
    }

    if (!selectedWarehouse) {
      console.error('[SAVE STOCK] ❌ Склад не выбран')
      toast.error('Выберите склад')
      return
    }

    const payload = {
      product_id: stock.product_id,
      article: stock.sku,
      new_quantity: newQuantity,
      warehouse_id: selectedWarehouse.id
    }
    
    console.log('[SAVE STOCK] 📤 Отправка запроса на /api/inventory/update-stock:', payload)

    try {
      const response = await api.put('/api/inventory/update-stock', payload)
      
      console.log('[SAVE STOCK] ✅ Успешный ответ от сервера:', response.data)

      toast.success(response.data.message || 'Остаток обновлён')
      
      // Обновить локальные данные
      setStocks(stocks.map(s => 
        s.id === stock.id 
          ? { ...s, quantity: newQuantity, available: newQuantity - s.reserved }
          : s
      ))
      
      cancelEdit()
    } catch (error) {
      console.error('[SAVE STOCK] ❌ Ошибка запроса:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })
      toast.error(error.response?.data?.detail || 'Ошибка обновления остатка')
      console.error(error)
    }
  }

  const handleSyncCatalog = async () => {
    setLoading(true)
    try {
      const result = await syncInventory()
      if (result && result.created > 0) {
        toast.success(`Добавлено ${result.created} новых товаров в остатки`)
      } else {
        toast.success('Каталог синхронизирован')
      }
      await loadStocks()
    } catch (error) {
      toast.error('Ошибка синхронизации каталога')
      console.error(error)
    }
    setLoading(false)
  }

  const syncAllStocks = async () => {
    if (!selectedWarehouse) {
      toast.error('Выберите склад для синхронизации')
      return
    }

    if (!selectedWarehouse.id) {
      console.error('❌ selectedWarehouse.id is missing!', selectedWarehouse)
      toast.error('Ошибка: у склада отсутствует ID')
      return
    }

    console.log('🔄 [SYNC-ALL-STOCKS] Начало синхронизации:', {
      warehouseId: selectedWarehouse.id,
      warehouseName: selectedWarehouse.name,
      warehouse: selectedWarehouse
    })

    if (!confirm(`Отправить все остатки на склад "${selectedWarehouse.name}"?`)) {
      return
    }

    setSyncing(true)
    try {
      // Проверяем, что warehouse_id существует
      if (!selectedWarehouse.id) {
        console.error('❌ [SYNC-ALL-STOCKS] selectedWarehouse.id is missing!', selectedWarehouse)
        toast.error('Ошибка: у склада отсутствует ID')
        setSyncing(false)
        return
      }
      
      const requestData = {
        warehouse_id: String(selectedWarehouse.id) // Явно преобразуем в строку
      }
      
      console.log('📤 [SYNC-ALL-STOCKS] Отправка запроса:', {
        url: '/api/inventory/sync-all-stocks',
        data: requestData,
        selectedWarehouse: selectedWarehouse
      })
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/09b067c6-83bd-40e3-9b15-a36beccac6c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StockPageV3.jsx:305',message:'Sending request',data:{url:'/api/inventory/sync-all-stocks',requestData,warehouseId:selectedWarehouse?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      const response = await api.post('/api/inventory/sync-all-stocks', requestData, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/09b067c6-83bd-40e3-9b15-a36beccac6c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StockPageV3.jsx:315',message:'Request success',data:{status:response.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      console.log('✅ [SYNC-ALL-STOCKS] Успешный ответ:', response.data)
      toast.success(response.data.message || 'Остатки синхронизированы')
    } catch (error) {
      console.error('❌ [SYNC-ALL-STOCKS] Ошибка:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText
      })
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/09b067c6-83bd-40e3-9b15-a36beccac6c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'StockPageV3.jsx:328',message:'Request failed',data:{error:error.message,status:error.response?.status,statusText:error.response?.statusText,url:error.config?.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const errorMessage = error.response?.data?.detail || error.message || 'Ошибка синхронизации'
      toast.error(errorMessage)
    }
    setSyncing(false)
  }

  // ============ ФУНКЦИИ ДЛЯ ИМПОРТА ОСТАТКОВ ============

  const openImportModal = async () => {
    try {
      // Загрузить интеграции
      const response = await api.get('/api/seller/api-keys')
      setIntegrations(response.data)
      setShowImportModal(true)
    } catch (error) {
      toast.error('Ошибка загрузки интеграций')
      console.error(error)
    }
  }

  const handleIntegrationSelect = async (integrationId) => {
    setSelectedIntegration(integrationId)
    setSelectedMpWarehouse(null)
    setMpWarehouses([])
    
    if (!integrationId) return
    
    try {
      // Загрузить склады МП
      const response = await api.get(`/api/inventory/marketplace-warehouses/${integrationId}`)
      setMpWarehouses(response.data.warehouses || [])
    } catch (error) {
      toast.error('Ошибка загрузки складов МП')
      console.error(error)
    }
  }

  const importStocksFromMarketplace = async () => {
    if (!selectedIntegration || !selectedMpWarehouse) {
      toast.error('Выберите интеграцию и склад')
      return
    }

    setImporting(true)
    try {
      const response = await api.post('/api/inventory/import-stocks-from-marketplace', {
        integration_id: selectedIntegration,
        marketplace_warehouse_id: selectedMpWarehouse
      })
      
      toast.success(response.data.message || 'Остатки импортированы')
      
      // Закрыть модалку и обновить данные
      setShowImportModal(false)
      await loadStocks()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка импорта остатков')
      console.error(error)
    }
    setImporting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-mm-cyan uppercase mb-2" data-testid="stocks-title">Остатки на складах</h2>
          <p className="text-mm-text-secondary text-sm">Управление остатками товаров и синхронизация с МП</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={openImportModal}
            className="btn-secondary flex items-center space-x-2 text-sm"
            data-testid="import-stocks-btn"
          >
            <FiDownload />
            <span>ИМПОРТ С МП</span>
          </button>
          <button
            onClick={handleSyncCatalog}
            disabled={loading}
            className="btn-secondary flex items-center space-x-2 disabled:opacity-50"
            data-testid="sync-catalog-btn"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            <span>СИНХРОНИЗИРОВАТЬ КАТАЛОГ</span>
          </button>
          <button
            onClick={syncAllStocks}
            disabled={!selectedWarehouse || syncing}
            className="btn-primary flex items-center space-x-2 disabled:opacity-50"
            data-testid="sync-all-btn"
          >
            <FiUpload />
            <span>{syncing ? 'СИНХРОНИЗАЦИЯ...' : 'ОТПРАВИТЬ ОСТАТКИ НА МП'}</span>
          </button>
          <button
            onClick={loadStocks}
            disabled={loading}
            className="btn-secondary flex items-center space-x-2"
            data-testid="refresh-btn"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            <span>ОБНОВИТЬ</span>
          </button>
        </div>
      </div>

      {/* Выбор склада */}
      <div className="card-neon p-4">
        <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Склад для синхронизации</label>
        <select
          value={selectedWarehouse?.id || ''}
          onChange={(e) => handleWarehouseChange(e.target.value)}
          className="input-neon w-full max-w-md"
          data-testid="warehouse-select"
        >
          <option value="">Выберите склад...</option>
          {warehouses.map(wh => (
            <option key={wh.id} value={wh.id}>
              {wh.name} {wh.sends_stock ? '(Отправляет остатки)' : ''}
            </option>
          ))}
        </select>
        <p className="text-xs text-mm-text-tertiary mt-2">
          {selectedWarehouse 
            ? `Выбран склад: ${selectedWarehouse.name}. Изменения будут синхронизированы на связанные МП.`
            : 'Выберите склад для работы с остатками'
          }
        </p>
      </div>

      {/* Панель поиска и фильтров */}
      {selectedWarehouse && stocks.length > 0 && (
        <div className="card-neon p-4 space-y-4">
          {/* Строка поиска и быстрых фильтров */}
          <div className="flex flex-wrap gap-4 items-end">
            {/* Поиск */}
            <div className="flex-1 min-w-[250px]">
              <label className="block text-xs text-mm-text-secondary uppercase mb-2">Поиск</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-mm-text-tertiary" />
                <input
                  type="text"
                  placeholder="Поиск по артикулу или названию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-neon w-full pl-10"
                  data-testid="search-input"
                />
              </div>
            </div>
            
            {/* Фильтр наличия */}
            <div className="min-w-[200px]">
              <label className="block text-xs text-mm-text-secondary uppercase mb-2">Наличие</label>
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="input-neon w-full"
                data-testid="availability-filter"
              >
                <option value="all">Все товары</option>
                <option value="in_stock">В наличии</option>
                <option value="out_of_stock">Нет в наличии</option>
              </select>
            </div>
            
            {/* Сортировка */}
            <div className="min-w-[200px]">
              <label className="block text-xs text-mm-text-secondary uppercase mb-2">Сортировка</label>
              <select
                value={sortConfig.field}
                onChange={(e) => toggleSort(e.target.value)}
                className="input-neon w-full"
                data-testid="sort-select"
              >
                <option value="sku">По артикулу</option>
                <option value="name">По названию</option>
                <option value="quantity">По количеству</option>
              </select>
            </div>
          </div>
          
          {/* Дополнительные фильтры */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Критический остаток */}
            <label className="flex items-center space-x-2 cursor-pointer" data-testid="critical-filter">
              <input
                type="checkbox"
                checked={showCriticalOnly}
                onChange={(e) => setShowCriticalOnly(e.target.checked)}
                className="w-4 h-4 bg-mm-dark border-mm-border rounded text-mm-cyan focus:ring-mm-cyan focus:ring-offset-0"
              />
              <span className="text-sm text-mm-text-secondary">Критический остаток</span>
            </label>
            
            {/* Зарезервировано */}
            <label className="flex items-center space-x-2 cursor-pointer" data-testid="reserved-filter">
              <input
                type="checkbox"
                checked={showReservedOnly}
                onChange={(e) => setShowReservedOnly(e.target.checked)}
                className="w-4 h-4 bg-mm-dark border-mm-border rounded text-mm-cyan focus:ring-mm-cyan focus:ring-offset-0"
              />
              <span className="text-sm text-mm-text-secondary">Только зарезервированные</span>
            </label>
            
            {/* Кнопка сброса */}
            {(searchQuery || availabilityFilter !== 'all' || showCriticalOnly || showReservedOnly || sortConfig.field !== 'sku') && (
              <button
                onClick={resetFilters}
                className="text-sm text-mm-cyan hover:text-mm-green transition-colors flex items-center space-x-1"
                data-testid="reset-filters-btn"
              >
                <FiX size={16} />
                <span>Сбросить фильтры</span>
              </button>
            )}
            
            {/* Счетчик результатов */}
            <div className="ml-auto text-sm text-mm-text-tertiary">
              Показано: <span className="text-mm-cyan font-mono">{filteredAndSortedStocks.length}</span> из {stocks.length}
            </div>
          </div>
        </div>
      )}

      {/* Таблица остатков */}
      {!selectedWarehouse ? (
        <div className="card-neon text-center py-16">
          <p className="text-mm-text-secondary text-lg">Выберите склад для работы с остатками</p>
        </div>
      ) : loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : stocks.length === 0 ? (
        <div className="card-neon text-center py-16">
          <p className="text-mm-text-secondary text-lg mb-2">Нет остатков</p>
          <p className="text-sm text-mm-text-tertiary">Создайте приёмку товара для добавления остатков</p>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-mm-border">
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Фото</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">SKU</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Название</th>
                <th className="text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Всего</th>
                <th className="text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Резерв</th>
                <th className="text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Доступно</th>
                <th className="text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedStocks.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center">
                    <p className="text-mm-text-secondary">Нет товаров, соответствующих фильтрам</p>
                    <button
                      onClick={resetFilters}
                      className="mt-2 text-sm text-mm-cyan hover:underline"
                    >
                      Сбросить фильтры
                    </button>
                  </td>
                </tr>
              ) : (
                filteredAndSortedStocks.map((item) => (
                <tr key={item.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                  <td className="py-4 px-4">
                    {item.product_image ? (
                      <img 
                        src={item.product_image} 
                        alt={item.product_name || item.sku}
                        className="w-12 h-12 object-cover rounded bg-mm-dark"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                      />
                    ) : null}
                    <div 
                      className="w-12 h-12 bg-mm-dark rounded flex items-center justify-center text-mm-text-secondary text-xs"
                      style={{ display: item.product_image ? 'none' : 'flex' }}
                    >
                      Нет фото
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono text-sm text-mm-cyan">{item.sku}</td>
                  <td className="py-4 px-4 text-sm">{item.product_name || '—'}</td>
                  <td className="py-4 px-4 text-center">
                    {editingRow === item.id ? (
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="input-neon w-24 text-center"
                        autoFocus
                        data-testid={`edit-input-${item.sku}`}
                      />
                    ) : (
                      <span className="font-mono font-bold">{item.quantity}</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center font-mono text-mm-yellow">{item.reserved}</td>
                  <td className="py-4 px-4 text-center font-mono font-bold text-mm-green">{item.available}</td>
                  <td className="py-4 px-4 text-center">
                    {editingRow === item.id ? (
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => saveStock(item)}
                          className="text-mm-green hover:text-mm-cyan transition-colors"
                          data-testid={`save-btn-${item.sku}`}
                        >
                          <FiCheck size={20} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-mm-red hover:text-mm-text-secondary transition-colors"
                          data-testid={`cancel-btn-${item.sku}`}
                        >
                          <FiX size={20} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(item)}
                        className="text-mm-cyan hover:text-mm-green transition-colors"
                        data-testid={`edit-btn-${item.sku}`}
                      >
                        <FiEdit2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Информация о автосинхронизации */}
      <div className="card-neon p-4 bg-mm-dark-secondary/30">
        <p className="text-sm text-mm-text-secondary">
          <span className="text-mm-cyan font-bold">ℹ️ АВТОСИНХРОНИЗАЦИЯ:</span> Остатки автоматически отправляются на МП каждые 15 минут.
          При изменении остатка вручную, синхронизация происходит сразу на выбранный склад.
        </p>
      </div>

      {/* МОДАЛЬНОЕ ОКНО ДЛЯ ИМПОРТА ОСТАТКОВ */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="card-neon max-w-md w-full p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl text-mm-cyan uppercase font-mono">Импорт остатков с МП</h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-mm-text-secondary hover:text-mm-cyan transition-colors"
              >
                <FiX size={24} />
              </button>
            </div>

            <p className="text-sm text-mm-text-secondary">
              Загрузить остатки из маркетплейса в базу данных
            </p>

            {/* Выбор интеграции */}
            <div>
              <label className="block text-sm mb-2 text-mm-text-secondary uppercase">
                Интеграция
              </label>
              <select
                value={selectedIntegration || ''}
                onChange={(e) => handleIntegrationSelect(e.target.value)}
                className="input-neon w-full"
              >
                <option value="">Выберите интеграцию...</option>
                {integrations.map(integration => (
                  <option key={integration.id} value={integration.id}>
                    {integration.marketplace.toUpperCase()} - {integration.name || integration.client_id}
                  </option>
                ))}
              </select>
            </div>

            {/* Выбор склада МП */}
            {selectedIntegration && (
              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">
                  Склад на маркетплейсе
                </label>
                <select
                  value={selectedMpWarehouse || ''}
                  onChange={(e) => setSelectedMpWarehouse(e.target.value)}
                  className="input-neon w-full"
                  disabled={mpWarehouses.length === 0}
                >
                  <option value="">Выберите склад...</option>
                  {mpWarehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
                {mpWarehouses.length === 0 && (
                  <p className="text-xs text-mm-text-tertiary mt-2">Загрузка складов...</p>
                )}
              </div>
            )}

            {/* Кнопки */}
            <div className="flex space-x-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="btn-secondary flex-1"
                disabled={importing}
              >
                ОТМЕНА
              </button>
              <button
                onClick={importStocksFromMarketplace}
                disabled={!selectedIntegration || !selectedMpWarehouse || importing}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {importing ? 'ИМПОРТ...' : 'ИМПОРТИРОВАТЬ'}
              </button>
            </div>

            <div className="text-xs text-mm-text-tertiary space-y-1">
              <p>• Остатки будут загружены из выбранного склада МП</p>
              <p>• Существующие остатки будут обновлены</p>
              <p>• Новые товары будут добавлены в инвентарь</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StockPageV3
