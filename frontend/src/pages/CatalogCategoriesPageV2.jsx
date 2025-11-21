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
  const [mappings, setMappings] = useState([])
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [currentMapping, setCurrentMapping] = useState({
    internal_name: '',
    ozon_category_id: null,
    wb_category_id: null,
    yandex_category_id: null
  })

  useEffect(() => {
    loadAllCategories()
  }, [])

  const loadAllCategories = async () => {
    setLoading(true)
    
    for (const mp of ['ozon', 'wb', 'yandex']) {
      await loadMarketplaceCategories(mp)
    }
    
    setLoading(false)
  }

  const loadMarketplaceCategories = async (marketplace) => {
    setLoadingCategories({ ...loadingCategories, [marketplace]: true })
    
    try {
      // Загружаем ВСЕ категории с нового endpoint
      const response = await api.get(`/api/categories/marketplace/${marketplace}/all?limit=1000`)
      const cats = response.data.categories || []
      
      setCategories(prev => ({
        ...prev,
        [marketplace]: cats
      }))
      
      console.log(`✅ Loaded ${cats.length} categories for ${marketplace}`)
    } catch (error) {
      console.error(`❌ Failed to load ${marketplace} categories:`, error)
      alert(`Ошибка загрузки категорий ${marketplace}: ${error.response?.data?.detail || error.message}`)
    } finally {
      setLoadingCategories({ ...loadingCategories, [marketplace]: false })
    }
  }

  const handleCreateMapping = () => {
    setShowMappingModal(true)
    setCurrentMapping({
      internal_name: '',
      ozon_category_id: null,
      wb_category_id: null,
      yandex_category_id: null
    })
  }

  const handleSaveMapping = async () => {
    try {
      await api.post('/api/categories/mappings', currentMapping)
      alert('✅ Сопоставление сохранено!')
      setShowMappingModal(false)
      loadMappings()
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const loadMappings = async () => {
    try {
      if (searchQuery) {
        const response = await api.get(`/api/categories/mappings/search?query=${searchQuery}`)
        setMappings(response.data.mappings || [])
      }
    } catch (error) {
      console.error('Failed to load mappings:', error)
    }
  }

  const filterCategories = (cats) => {
    if (!searchQuery) return cats.slice(0, 100)
    
    return cats.filter(cat => 
      cat.category_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.name?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 100)
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
            <p className="text-mm-text-secondary">
              Управление категориями и их сопоставление между маркетплейсами
            </p>
          </div>
          
          <button
            onClick={handleCreateMapping}
            className="px-4 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded flex items-center gap-2"
          >
            <FiLink /> СОПОСТАВИТЬ
          </button>
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
            className="w-full px-4 py-3 pl-10 bg-mm-secondary border border-mm-border rounded-lg text-mm-text focus:border-mm-cyan outline-none"
          />
          <FiSearch className="absolute left-3 top-4 text-mm-text-secondary" />
        </div>
      </div>

      {/* Info Banner */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FiAlertCircle className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-300">
              <p className="font-medium mb-1">ℹ️ Как работает система категорий:</p>
              <ul className="space-y-1 text-blue-200">
                <li>• Категории загружаются автоматически при наличии API ключей маркетплейсов</li>
                <li>• Сопоставьте категории между маркетплейсами для удобного управления</li>
                <li>• В карточке товара выберите категорию - характеристики подтянутся автоматически</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ozon */}
        <div className="bg-mm-secondary border border-blue-500/30 rounded-lg overflow-hidden">
          <div className="bg-blue-500/20 px-4 py-3 border-b border-blue-500/30">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-blue-400 flex items-center gap-2">
                🔵 OZON
                <span className="text-xs font-normal text-mm-text-secondary">
                  ({filterCategories(categories.ozon).length})
                </span>
              </h3>
              <button
                onClick={() => loadMarketplaceCategories('ozon')}
                disabled={loadingCategories.ozon}
                className="text-blue-400 hover:text-blue-300"
              >
                <FiRefreshCw className={loadingCategories.ozon ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          
          <div className="p-4 max-h-96 overflow-y-auto space-y-2">
            {loadingCategories.ozon ? (
              <div className="text-center text-mm-text-secondary py-8">
                <FiRefreshCw className="animate-spin inline mb-2" />
                <p>Загрузка...</p>
              </div>
            ) : filterCategories(categories.ozon).length > 0 ? (
              filterCategories(categories.ozon).map((cat, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-mm-dark border border-blue-500/20 rounded hover:border-blue-500/50 cursor-pointer transition-colors"
                  onClick={() => {
                    setCurrentMapping({
                      ...currentMapping,
                      ozon_category_id: cat.category_id,
                      internal_name: currentMapping.internal_name || cat.category_name
                    })
                    setShowMappingModal(true)
                  }}
                >
                  <p className="text-sm text-mm-text font-medium">{cat.category_name || cat.name}</p>
                  {cat.type_name && (
                    <p className="text-xs text-mm-text-secondary mt-1">Тип: {cat.type_name}</p>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center text-mm-text-secondary py-8">
                <p>Нет категорий</p>
                <p className="text-xs mt-2">Добавьте API ключ Ozon в разделе Интеграции</p>
              </div>
            )}
          </div>
        </div>

        {/* Wildberries */}
        <div className="bg-mm-secondary border border-purple-500/30 rounded-lg overflow-hidden">
          <div className="bg-purple-500/20 px-4 py-3 border-b border-purple-500/30">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-purple-400 flex items-center gap-2">
                🟣 WILDBERRIES
                <span className="text-xs font-normal text-mm-text-secondary">
                  ({filterCategories(categories.wb).length})
                </span>
              </h3>
              <button
                onClick={() => loadMarketplaceCategories('wb')}
                disabled={loadingCategories.wb}
                className="text-purple-400 hover:text-purple-300"
              >
                <FiRefreshCw className={loadingCategories.wb ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          
          <div className="p-4 max-h-96 overflow-y-auto space-y-2">
            {loadingCategories.wb ? (
              <div className="text-center text-mm-text-secondary py-8">
                <FiRefreshCw className="animate-spin inline mb-2" />
                <p>Загрузка...</p>
              </div>
            ) : filterCategories(categories.wb).length > 0 ? (
              filterCategories(categories.wb).map((cat, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-mm-dark border border-purple-500/20 rounded hover:border-purple-500/50 cursor-pointer transition-colors"
                  onClick={() => {
                    setCurrentMapping({
                      ...currentMapping,
                      wb_category_id: cat.id,
                      internal_name: currentMapping.internal_name || cat.name
                    })
                    setShowMappingModal(true)
                  }}
                >
                  <p className="text-sm text-mm-text font-medium">{cat.name}</p>
                </div>
              ))
            ) : (
              <div className="text-center text-mm-text-secondary py-8">
                <p>Нет категорий</p>
                <p className="text-xs mt-2">Добавьте API ключ WB в разделе Интеграции</p>
              </div>
            )}
          </div>
        </div>

        {/* Yandex */}
        <div className="bg-mm-secondary border border-yellow-500/30 rounded-lg overflow-hidden">
          <div className="bg-yellow-500/20 px-4 py-3 border-b border-yellow-500/30">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-yellow-400 flex items-center gap-2">
                🟡 ЯНДЕКС МАРКЕТ
                <span className="text-xs font-normal text-mm-text-secondary">
                  ({filterCategories(categories.yandex).length})
                </span>
              </h3>
              <button
                onClick={() => loadMarketplaceCategories('yandex')}
                disabled={loadingCategories.yandex}
                className="text-yellow-400 hover:text-yellow-300"
              >
                <FiRefreshCw className={loadingCategories.yandex ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          
          <div className="p-4 max-h-96 overflow-y-auto space-y-2">
            {loadingCategories.yandex ? (
              <div className="text-center text-mm-text-secondary py-8">
                <FiRefreshCw className="animate-spin inline mb-2" />
                <p>Загрузка...</p>
              </div>
            ) : filterCategories(categories.yandex).length > 0 ? (
              filterCategories(categories.yandex).map((cat, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-mm-dark border border-yellow-500/20 rounded hover:border-yellow-500/50 cursor-pointer transition-colors"
                  onClick={() => {
                    setCurrentMapping({
                      ...currentMapping,
                      yandex_category_id: cat.id,
                      internal_name: currentMapping.internal_name || cat.name
                    })
                    setShowMappingModal(true)
                  }}
                >
                  <p className="text-sm text-mm-text font-medium">{cat.name}</p>
                </div>
              ))
            ) : (
              <div className="text-center text-mm-text-secondary py-8">
                <p>Нет категорий</p>
                <p className="text-xs mt-2">Добавьте API ключ Яндекса в разделе Интеграции</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-mm-secondary border border-mm-border rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold text-mm-cyan mb-4">
              Создать сопоставление категорий
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-mm-text-secondary mb-2">
                  Название категории <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={currentMapping.internal_name}
                  onChange={(e) => setCurrentMapping({ ...currentMapping, internal_name: e.target.value })}
                  placeholder="Например: Кроссовки спортивные"
                  className="w-full px-4 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-blue-400 mb-2">Категория Ozon</label>
                  <select
                    value={currentMapping.ozon_category_id || ''}
                    onChange={(e) => setCurrentMapping({ ...currentMapping, ozon_category_id: e.target.value })}
                    className="w-full px-3 py-2 bg-mm-dark border border-blue-500/30 rounded text-mm-text focus:border-blue-500 outline-none"
                  >
                    <option value="">Не выбрано</option>
                    {categories.ozon.slice(0, 100).map((cat, idx) => (
                      <option key={idx} value={cat.category_id}>
                        {cat.category_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-purple-400 mb-2">Категория WB</label>
                  <select
                    value={currentMapping.wb_category_id || ''}
                    onChange={(e) => setCurrentMapping({ ...currentMapping, wb_category_id: e.target.value })}
                    className="w-full px-3 py-2 bg-mm-dark border border-purple-500/30 rounded text-mm-text focus:border-purple-500 outline-none"
                  >
                    <option value="">Не выбрано</option>
                    {categories.wb.slice(0, 100).map((cat, idx) => (
                      <option key={idx} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-yellow-400 mb-2">Категория Яндекс</label>
                  <select
                    value={currentMapping.yandex_category_id || ''}
                    onChange={(e) => setCurrentMapping({ ...currentMapping, yandex_category_id: e.target.value })}
                    className="w-full px-3 py-2 bg-mm-dark border border-yellow-500/30 rounded text-mm-text focus:border-yellow-500 outline-none"
                  >
                    <option value="">Не выбрано</option>
                    {categories.yandex.slice(0, 100).map((cat, idx) => (
                      <option key={idx} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowMappingModal(false)}
                  className="px-4 py-2 bg-mm-dark text-mm-text hover:bg-mm-dark/70 rounded"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveMapping}
                  disabled={!currentMapping.internal_name}
                  className="px-4 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-sm text-blue-400 mb-1">Категорий Ozon</p>
          <p className="text-2xl font-bold text-blue-300">{categories.ozon.length}</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
          <p className="text-sm text-purple-400 mb-1">Категорий WB</p>
          <p className="text-2xl font-bold text-purple-300">{categories.wb.length}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-sm text-yellow-400 mb-1">Категорий Яндекс</p>
          <p className="text-2xl font-bold text-yellow-300">{categories.yandex.length}</p>
        </div>
      </div>
    </div>
  )
}
