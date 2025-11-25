import React, { useState, useEffect } from 'react'
import { FiArrowLeft, FiRefreshCw, FiCheck, FiLink, FiSearch, FiAlertCircle } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

export default function CatalogCategoriesPageV2() {
  const { api } = useAuth()
  const [loading, setLoading] = useState(false)
  const [loadingCategories, setLoadingCategories] = useState({})
  const [categories, setCategories] = useState({
    ozon: [],
    wb: [],
    yandex: []
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [currentMapping, setCurrentMapping] = useState({
    internal_name: '',
    ozon_category_id: '',
    ozon_type_id: '',
    wb_category_id: '',
    yandex_category_id: ''
  })
  
  // Search in modal
  const [modalSearch, setModalSearch] = useState({
    ozon: '',
    wb: '',
    yandex: ''
  })
  const [searchResults, setSearchResults] = useState({
    ozon: [],
    wb: [],
    yandex: []
  })
  const [searching, setSearching] = useState({})

  useEffect(() => {
    loadAllCategories()
  }, [])

  const loadAllCategories = async () => {
    setLoading(true)
    
    for (const mp of ['ozon', 'wb']) {
      await loadMarketplaceCategories(mp)
    }
    
    setLoading(false)
  }

  const loadMarketplaceCategories = async (marketplace) => {
    setLoadingCategories(prev => ({ ...prev, [marketplace]: true }))
    
    try {
      // Для WB используем кэш
      const url = marketplace === 'wb' 
        ? `/api/categories/wb/cached`
        : `/api/categories/marketplace/${marketplace}?limit=1000`
      
      const response = await api.get(url)
      setCategories(prev => ({
        ...prev,
        [marketplace]: response.data.categories || []
      }))
    } catch (error) {
      console.error(`Failed to load ${marketplace} categories:`, error)
      alert(`Ошибка загрузки категорий ${marketplace}`)
    } finally {
      setLoadingCategories(prev => ({ ...prev, [marketplace]: false }))
    }
  }
  
  const preloadWBCategories = async () => {
    if (!confirm('Загрузить категории Wildberries?\n\nЭто займет 10-20 секунд.')) return
    
    setLoading(true)
    try {
      const response = await api.post('/api/categories/wb/preload')
      
      if (response.data.success) {
        alert(`✅ ${response.data.message}`)
        await loadMarketplaceCategories('wb')
      } else {
        alert(`❌ Ошибка: ${response.data.error}`)
      }
    } catch (error) {
      console.error('WB preload error:', error)
      alert(`❌ Ошибка загрузки: ${error.response?.data?.detail || error.message}`)
    } finally {
      setLoading(false)
    }
  }
  
  const preloadOzonCategories = async () => {
    if (!confirm('Загрузить категории Ozon?\n\nЭто займет 30-60 секунд.\n\n11,000+ категорий будут загружены в базу.')) return
    
    setLoading(true)
    try {
      const response = await api.post('/api/categories/ozon/preload')
      
      if (response.data.success) {
        alert(`✅ ${response.data.message}\n\nЗагружено: ${response.data.loaded} категорий`)
        await loadMarketplaceCategories('ozon')
      } else {
        alert(`❌ Ошибка: ${response.data.error}`)
      }
    } catch (error) {
      console.error('Ozon preload error:', error)
      alert(`❌ Ошибка загрузки: ${error.response?.data?.detail || error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateMapping = () => {
    setShowMappingModal(true)
    setCurrentMapping({
      internal_name: '',
      ozon_category_id: '',
      ozon_type_id: '',
      wb_category_id: '',
      yandex_category_id: ''
    })
    setModalSearch({ ozon: '', wb: '', yandex: '' })
    setSearchResults({ ozon: [], wb: [], yandex: [] })
  }
  
  // Search marketplace categories in modal
  const searchInModal = async (marketplace) => {
    const query = modalSearch[marketplace]
    if (!query || query.length < 2) {
      setSearchResults(prev => ({ ...prev, [marketplace]: [] }))
      return
    }
    
    setSearching(prev => ({ ...prev, [marketplace]: true }))
    
    try {
      const response = await api.get(`/api/categories/marketplace/${marketplace}/search?query=${encodeURIComponent(query)}`)
      const results = response.data.categories || []
      setSearchResults(prev => ({ ...prev, [marketplace]: results.slice(0, 50) }))
    } catch (error) {
      console.error(`Search error for ${marketplace}:`, error)
      alert(`Ошибка поиска: ${error.response?.data?.detail || error.message}`)
    } finally {
      setSearching(prev => ({ ...prev, [marketplace]: false }))
    }
  }
  
  const selectFromSearch = (marketplace, category) => {
    if (marketplace === 'ozon') {
      setCurrentMapping(prev => ({
        ...prev,
        ozon_category_id: category.category_id || category.id,
        ozon_type_id: category.type_id || ''
      }))
    } else if (marketplace === 'wb') {
      setCurrentMapping(prev => ({
        ...prev,
        wb_category_id: category.category_id || category.id
      }))
    } else if (marketplace === 'yandex') {
      setCurrentMapping(prev => ({
        ...prev,
        yandex_category_id: category.category_id || category.id
      }))
    }
    
    // Clear search after selection
    setModalSearch(prev => ({ ...prev, [marketplace]: '' }))
    setSearchResults(prev => ({ ...prev, [marketplace]: [] }))
  }

  const handleSaveMapping = async () => {
    if (!currentMapping.internal_name) {
      alert('Введите название категории')
      return
    }
    
    try {
      const payload = {
        internal_name: currentMapping.internal_name,
        ozon_category_id: currentMapping.ozon_category_id || null,
        wb_category_id: currentMapping.wb_category_id || null,
        yandex_category_id: currentMapping.yandex_category_id || null
      }
      
      await api.post('/api/categories/mappings', payload)
      
      // Также сохраним type_id для Ozon в БД
      if (currentMapping.ozon_category_id && currentMapping.ozon_type_id) {
        // Обновим маппинг с type_id через дополнительный вызов
        // Это можно сделать позже через отдельный endpoint
      }
      
      alert('✅ Сопоставление сохранено!')
      setShowMappingModal(false)
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const filterCategories = (cats) => {
    if (!searchQuery) return cats.slice(0, 200)
    
    const query = searchQuery.toLowerCase()
    return cats.filter(cat => {
      const name = cat.category_name || cat.name || ''
      return name.toLowerCase().includes(query)
    }).slice(0, 200)
  }

  const handleCategorySelect = (marketplace, category) => {
    if (marketplace === 'ozon') {
      setCurrentMapping(prev => ({
        ...prev,
        ozon_category_id: category.category_id,
        ozon_type_id: category.type_id || '',
        internal_name: prev.internal_name || category.category_name
      }))
    } else if (marketplace === 'wb') {
      setCurrentMapping(prev => ({
        ...prev,
        wb_category_id: category.id,
        internal_name: prev.internal_name || category.name
      }))
    }
    
    console.log('Category selected:', marketplace, category)
  }

  return (
    <div className="min-h-screen bg-mm-black text-mm-text p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="text-mm-cyan hover:underline mb-4 flex items-center gap-2"
        >
          <FiArrowLeft /> Назад к товарам
        </button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-mm-cyan mb-2">КАТЕГОРИИ МАРКЕТПЛЕЙСОВ</h1>
            <p className="text-gray-400">
              Управление категориями и их сопоставление между маркетплейсами
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={preloadWBCategories}
              disabled={loading}
              className="px-6 py-3 bg-purple-600 text-white hover:bg-purple-700 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
              title="Загрузить категории Wildberries в базу"
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} /> 
              ЗАГРУЗИТЬ WB
            </button>
            
            <button
              onClick={preloadOzonCategories}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
              title="Загрузить категории Ozon в базу"
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} /> 
              ЗАГРУЗИТЬ OZON
            </button>
            
            <button
              onClick={handleCreateMapping}
              className="px-6 py-3 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded-lg font-bold flex items-center gap-2"
            >
              <FiLink /> СОПОСТАВИТЬ
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию категории..."
            className="w-full px-4 py-3 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-mm-cyan focus:ring-2 focus:ring-mm-cyan/50 outline-none"
          />
          <FiSearch className="absolute left-3 top-4 text-gray-500" />
        </div>
      </div>

      {/* Info Banner */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FiAlertCircle className="text-blue-400 mt-0.5 flex-shrink-0 text-xl" />
            <div className="text-sm">
              <p className="font-medium mb-2 text-blue-300">📚 Новая Система: Категории загружаются в базу!</p>
              <ul className="space-y-1 text-gray-300">
                <li><strong>1. Загрузка WB:</strong> Нажмите "ЗАГРУЗИТЬ WB" → категории сохранятся в базу (быстро!)</li>
                <li><strong>2. Импорт товаров:</strong> При импорте с WB категории добавляются автоматически</li>
                <li><strong>3. Поиск:</strong> В модальном окне "СОПОСТАВИТЬ" используйте поиск - категории берутся из базы</li>
                <li className="text-purple-300">✅ Больше нет долгих загрузок и таймаутов!</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ozon */}
        <div className="bg-gray-900 border-2 border-blue-500/50 rounded-lg overflow-hidden">
          <div className="bg-blue-600/20 px-4 py-3 border-b border-blue-500/50">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-blue-400 flex items-center gap-2 text-lg">
                🔵 OZON
                <span className="text-xs font-normal text-gray-400">
                  ({filterCategories(categories.ozon).length})
                </span>
              </h3>
              <button
                onClick={() => loadMarketplaceCategories('ozon')}
                disabled={loadingCategories.ozon}
                className="text-blue-400 hover:text-blue-300 p-2"
                title="Обновить"
              >
                <FiRefreshCw className={loadingCategories.ozon ? 'animate-spin' : ''} size={18} />
              </button>
            </div>
          </div>
          
          <div className="p-4 max-h-96 overflow-y-auto space-y-2">
            {loadingCategories.ozon ? (
              <div className="text-center text-gray-400 py-8">
                <FiRefreshCw className="animate-spin inline mb-2 text-2xl" />
                <p>Загрузка...</p>
              </div>
            ) : filterCategories(categories.ozon).length > 0 ? (
              filterCategories(categories.ozon).map((cat, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-800 border border-blue-500/30 rounded hover:border-blue-500 hover:bg-gray-700 cursor-pointer transition-all"
                  onClick={() => handleCategorySelect('ozon', cat)}
                >
                  <p className="text-sm text-white font-medium">{cat.category_name || cat.name}</p>
                  {cat.type_name && (
                    <p className="text-xs text-gray-400 mt-1">Тип: {cat.type_name}</p>
                  )}
                  {cat.type_id && (
                    <p className="text-xs text-blue-400 mt-1">Type ID: {cat.type_id}</p>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 py-8">
                <p>Нет категорий</p>
                <p className="text-xs mt-2">Добавьте API ключ Ozon</p>
              </div>
            )}
          </div>
        </div>

        {/* Wildberries */}
        <div className="bg-gray-900 border-2 border-purple-500/50 rounded-lg overflow-hidden">
          <div className="bg-purple-600/20 px-4 py-3 border-b border-purple-500/50">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-purple-400 flex items-center gap-2 text-lg">
                🟣 WILDBERRIES
                <span className="text-xs font-normal text-gray-400">
                  ({filterCategories(categories.wb).length})
                </span>
              </h3>
              <button
                onClick={() => loadMarketplaceCategories('wb')}
                disabled={loadingCategories.wb}
                className="text-purple-400 hover:text-purple-300 p-2"
                title="Обновить"
              >
                <FiRefreshCw className={loadingCategories.wb ? 'animate-spin' : ''} size={18} />
              </button>
            </div>
          </div>
          
          <div className="p-4 max-h-96 overflow-y-auto space-y-2">
            {loadingCategories.wb ? (
              <div className="text-center text-gray-400 py-8">
                <FiRefreshCw className="animate-spin inline mb-2 text-2xl" />
                <p>Загрузка...</p>
              </div>
            ) : filterCategories(categories.wb).length > 0 ? (
              filterCategories(categories.wb).map((cat, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-800 border border-purple-500/30 rounded hover:border-purple-500 hover:bg-gray-700 cursor-pointer transition-all"
                  onClick={() => handleCategorySelect('wb', cat)}
                >
                  <p className="text-sm text-white font-medium">{cat.name}</p>
                  <p className="text-xs text-purple-400 mt-1">ID: {cat.id}</p>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 py-8">
                <p>Нет категорий</p>
                <p className="text-xs mt-2">Добавьте API ключ WB</p>
              </div>
            )}
          </div>
        </div>

        {/* Yandex */}
        <div className="bg-gray-900 border-2 border-yellow-500/50 rounded-lg overflow-hidden">
          <div className="bg-yellow-600/20 px-4 py-3 border-b border-yellow-500/50">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-yellow-400 flex items-center gap-2 text-lg">
                🟡 ЯНДЕКС МАРКЕТ
                <span className="text-xs font-normal text-gray-400">
                  ({filterCategories(categories.yandex).length})
                </span>
              </h3>
              <button
                onClick={() => loadMarketplaceCategories('yandex')}
                disabled={loadingCategories.yandex}
                className="text-yellow-400 hover:text-yellow-300 p-2"
                title="Обновить"
              >
                <FiRefreshCw className={loadingCategories.yandex ? 'animate-spin' : ''} size={18} />
              </button>
            </div>
          </div>
          
          <div className="p-4 max-h-96 overflow-y-auto space-y-2">
            <div className="text-center text-gray-400 py-8">
              <p>Нет API ключа</p>
              <p className="text-xs mt-2">Добавьте интеграцию Яндекс</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border-2 border-mm-cyan rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold text-mm-cyan mb-4">
              Создать сопоставление категорий
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">
                  Название категории <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={currentMapping.internal_name}
                  onChange={(e) => setCurrentMapping({ ...currentMapping, internal_name: e.target.value })}
                  placeholder="Например: Кроссовки спортивные"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-mm-cyan focus:ring-2 focus:ring-mm-cyan/50 outline-none"
                />
              </div>

              {/* Ozon Search */}
              <div className="border-2 border-blue-500/50 rounded-lg p-4 bg-blue-900/10">
                <label className="block text-sm text-blue-400 mb-2 font-bold">
                  🔵 Категория Ozon
                  {currentMapping.ozon_category_id && (
                    <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                      ✓ Выбрано: {currentMapping.ozon_category_id}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={modalSearch.ozon}
                    onChange={(e) => setModalSearch(prev => ({ ...prev, ozon: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && searchInModal('ozon')}
                    placeholder="🔍 Поиск категории Ozon (мин. 2 символа)..."
                    className="w-full px-4 py-3 pr-24 bg-gray-800 border border-blue-500/50 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 outline-none"
                  />
                  <button
                    onClick={() => searchInModal('ozon')}
                    disabled={searching.ozon || modalSearch.ozon.length < 2}
                    className="absolute right-2 top-1.5 px-4 py-2 bg-blue-500 text-white rounded font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {searching.ozon ? '⏳' : 'ИСКАТЬ'}
                  </button>
                </div>
                
                {searchResults.ozon.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto bg-gray-800 border-2 border-blue-500/50 rounded-lg">
                    {searchResults.ozon.map((cat, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectFromSearch('ozon', cat)}
                        className="w-full px-4 py-3 text-left hover:bg-blue-500/20 border-b border-gray-700 last:border-b-0 transition-colors"
                      >
                        <p className="font-medium text-white">{cat.category_name || cat.name}</p>
                        <p className="text-xs text-blue-400 mt-1">
                          ID: {cat.category_id || cat.id}
                          {cat.type_id && ` | Type: ${cat.type_id}`}
                          {cat.type_name && ` | ${cat.type_name}`}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                
                {modalSearch.ozon && searchResults.ozon.length === 0 && !searching.ozon && (
                  <p className="text-sm text-gray-400 mt-2">Нажмите "ИСКАТЬ" или Enter</p>
                )}
              </div>

              {/* WB Search */}
              <div className="border-2 border-purple-500/50 rounded-lg p-4 bg-purple-900/10">
                <label className="block text-sm text-purple-400 mb-2 font-bold">
                  🟣 Категория Wildberries
                  {currentMapping.wb_category_id && (
                    <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                      ✓ Выбрано: {currentMapping.wb_category_id}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={modalSearch.wb}
                    onChange={(e) => setModalSearch(prev => ({ ...prev, wb: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && searchInModal('wb')}
                    placeholder="🔍 Поиск категории WB (мин. 2 символа)..."
                    className="w-full px-4 py-3 pr-24 bg-gray-800 border border-purple-500/50 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 outline-none"
                  />
                  <button
                    onClick={() => searchInModal('wb')}
                    disabled={searching.wb || modalSearch.wb.length < 2}
                    className="absolute right-2 top-1.5 px-4 py-2 bg-purple-500 text-white rounded font-bold hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {searching.wb ? '⏳' : 'ИСКАТЬ'}
                  </button>
                </div>
                
                {searchResults.wb.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto bg-gray-800 border-2 border-purple-500/50 rounded-lg">
                    {searchResults.wb.map((cat, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectFromSearch('wb', cat)}
                        className="w-full px-4 py-3 text-left hover:bg-purple-500/20 border-b border-gray-700 last:border-b-0 transition-colors"
                      >
                        <p className="font-medium text-white">{cat.category_name || cat.name}</p>
                        <p className="text-xs text-purple-400 mt-1">
                          ID: {cat.category_id || cat.id}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                
                {modalSearch.wb && searchResults.wb.length === 0 && !searching.wb && (
                  <p className="text-sm text-gray-400 mt-2">Нажмите "ИСКАТЬ" или Enter</p>
                )}
              </div>
              
              {/* Preview */}
              {currentMapping.internal_name && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-2">Предпросмотр:</p>
                  <p className="text-white font-medium mb-2">{currentMapping.internal_name}</p>
                  <div className="flex gap-2">
                    {currentMapping.ozon_category_id && (
                      <span className="px-2 py-1 bg-blue-600/30 border border-blue-500/50 text-blue-300 text-xs rounded">
                        Ozon
                      </span>
                    )}
                    {currentMapping.wb_category_id && (
                      <span className="px-2 py-1 bg-purple-600/30 border border-purple-500/50 text-purple-300 text-xs rounded">
                        WB
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowMappingModal(false)}
                  className="px-4 py-2 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded-lg border border-gray-700"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveMapping}
                  disabled={!currentMapping.internal_name}
                  className="px-6 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="max-w-7xl mx-auto mt-6 grid grid-cols-3 gap-4">
        <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-4">
          <p className="text-sm text-blue-400 mb-1">Категорий Ozon</p>
          <p className="text-3xl font-bold text-blue-300">{categories.ozon.length}</p>
        </div>
        <div className="bg-purple-600/20 border border-purple-500/50 rounded-lg p-4">
          <p className="text-sm text-purple-400 mb-1">Категорий WB</p>
          <p className="text-3xl font-bold text-purple-300">{categories.wb.length}</p>
        </div>
        <div className="bg-yellow-600/20 border border-yellow-500/50 rounded-lg p-4">
          <p className="text-sm text-yellow-400 mb-1">Категорий Яндекс</p>
          <p className="text-3xl font-bold text-yellow-300">{categories.yandex.length}</p>
        </div>
      </div>
    </div>
  )
}
