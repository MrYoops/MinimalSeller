import React, { useState, useEffect } from 'react'
import { FiSearch, FiCheck, FiAlertCircle, FiLoader } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

/**
 * Компонент для быстрого выбора категории маркетплейса
 * Показывается когда МП выбран, но категория не сопоставлена
 * Автоматически ищет похожие категории и предлагает выбрать
 */
export default function QuickCategoryMatcher({
  marketplace,
  currentMappingId,
  currentCategoryName = '',
  onCategorySelected,
  onSkip
}) {
  const { api } = useAuth()
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [manualSearch, setManualSearch] = useState(false)
  const [selecting, setSelecting] = useState(false)
  
  const mpConfig = {
    ozon: {
      name: 'Ozon',
      color: 'blue',
      icon: '🟠',
      borderClass: 'border-blue-500',
      bgClass: 'bg-blue-900/20',
      textClass: 'text-blue-400'
    },
    wb: {
      name: 'Wildberries',
      color: 'purple',
      icon: '🟣',
      borderClass: 'border-purple-500',
      bgClass: 'bg-purple-900/20',
      textClass: 'text-purple-400'
    },
    yandex: {
      name: 'Яндекс Маркет',
      color: 'yellow',
      icon: '🟡',
      borderClass: 'border-yellow-500',
      bgClass: 'bg-yellow-900/20',
      textClass: 'text-yellow-400'
    }
  }
  
  const config = mpConfig[marketplace] || mpConfig.ozon
  
  // Автопоиск при монтировании
  useEffect(() => {
    if (currentCategoryName) {
      autoSearchSimilarCategories(currentCategoryName)
    } else {
      setLoading(false)
    }
  }, [currentCategoryName, marketplace])
  
  const autoSearchSimilarCategories = async (searchTerm) => {
    setLoading(true)
    try {
      // Поиск похожих категорий в кэше маркетплейса
      const response = await api.get(`/api/categories/marketplace/${marketplace}/search?query=${encodeURIComponent(searchTerm)}&limit=5`)
      const categories = response.data.categories || []
      
      console.log(`[QuickMatcher] Found ${categories.length} similar ${marketplace} categories for "${searchTerm}"`)
      setSuggestions(categories)
    } catch (error) {
      console.error('[QuickMatcher] Search error:', error)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }
  
  const handleManualSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) return
    
    setLoading(true)
    try {
      const response = await api.get(`/api/categories/marketplace/${marketplace}/search?query=${encodeURIComponent(searchQuery)}&limit=10`)
      const categories = response.data.categories || []
      
      setSuggestions(categories)
    } catch (error) {
      console.error('[QuickMatcher] Manual search error:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const selectCategory = async (category) => {
    setSelecting(true)
    try {
      const categoryId = String(category.category_id || category.id)
      const categoryName = category.category_name || category.name
      const typeId = category.type_id || null
      
      console.log(`[QuickMatcher] Selecting ${marketplace} category:`, categoryId, categoryName)
      
      // Обновить маппинг через backend
      const updateData = {
        mapping_id: currentMappingId,
        marketplace: marketplace,
        category_id: categoryId,
        category_name: categoryName
      }
      
      if (typeId && marketplace === 'ozon') {
        updateData.type_id = typeId
      }
      
      const response = await api.post('/api/categories/mappings/quick-update', updateData)
      
      console.log('[QuickMatcher] Mapping updated:', response.data)
      
      // Уведомить родителя
      if (onCategorySelected) {
        onCategorySelected(marketplace, categoryId, categoryName, typeId)
      }
      
    } catch (error) {
      console.error('[QuickMatcher] Selection error:', error)
      alert(`Ошибка: ${error.response?.data?.detail || error.message}`)
    } finally {
      setSelecting(false)
    }
  }
  
  if (loading) {
    return (
      <div className={`${config.bgClass} border ${config.borderClass} border-opacity-30 rounded-lg p-4`}>
        <div className="flex items-center gap-3">
          <FiLoader className={`animate-spin ${config.textClass}`} size={20} />
          <p className="text-sm text-gray-300">Ищу похожие категории {config.name}...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className={`${config.bgClass} border ${config.borderClass} border-opacity-30 rounded-lg p-4`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <FiAlertCircle className={`${config.textClass} flex-shrink-0 mt-0.5`} size={20} />
        <div className="flex-1">
          <h4 className={`font-semibold ${config.textClass} mb-1`}>
            {config.icon} Категория {config.name} не выбрана
          </h4>
          <p className="text-sm text-gray-400">
            Текущая категория: <span className="text-white font-medium">"{currentCategoryName}"</span>
          </p>
        </div>
      </div>
      
      {/* Suggestions */}
      {!manualSearch && suggestions.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-xs text-gray-400 uppercase font-semibold">Автопоиск нашел:</p>
          
          {suggestions.slice(0, 3).map((cat, idx) => {
            const catId = cat.category_id || cat.id
            const catName = cat.category_name || cat.name
            
            return (
              <button
                key={catId}
                onClick={() => selectCategory(cat)}
                disabled={selecting}
                className={`w-full text-left p-3 rounded border ${config.borderClass} border-opacity-40 hover:border-opacity-100 bg-gray-800/50 hover:bg-gray-700/50 transition-all group disabled:opacity-50`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {idx === 0 && <span className="text-yellow-400 mr-2">⭐</span>}
                    <span className="text-white font-medium">{catName}</span>
                    <span className="text-gray-500 text-xs ml-2">ID: {catId}</span>
                  </div>
                  <span className={`px-3 py-1 rounded text-xs font-semibold ${config.textClass} border ${config.borderClass} border-opacity-50 group-hover:border-opacity-100 transition-all`}>
                    {selecting ? 'Выбираю...' : '✓ ВЫБРАТЬ'}
                  </span>
                </div>
              </button>
            )
          })}
          
          {suggestions.length > 3 && (
            <button
              onClick={() => setManualSearch(true)}
              className="text-sm text-gray-400 hover:text-gray-200 transition"
            >
              Показать еще {suggestions.length - 3}...
            </button>
          )}
        </div>
      )}
      
      {/* Manual search */}
      {manualSearch && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                placeholder={`Поиск категории ${config.name}...`}
                className="w-full pl-10 pr-3 py-2 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/50 outline-none"
              />
            </div>
            <button
              onClick={handleManualSearch}
              disabled={!searchQuery || loading}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded font-semibold disabled:opacity-50 transition"
            >
              {loading ? <FiLoader className="animate-spin" /> : 'ИСКАТЬ'}
            </button>
          </div>
          
          {/* Manual search results */}
          {suggestions.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {suggestions.map((cat) => {
                const catId = cat.category_id || cat.id
                const catName = cat.category_name || cat.name
                
                return (
                  <button
                    key={catId}
                    onClick={() => selectCategory(cat)}
                    disabled={selecting}
                    className="w-full text-left p-2 rounded border border-gray-700 hover:border-gray-500 bg-gray-800/50 hover:bg-gray-700/50 transition group disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <span className="text-white text-sm">{catName}</span>
                        <span className="text-gray-500 text-xs ml-2">ID: {catId}</span>
                      </div>
                      <span className="text-xs text-cyan-400 group-hover:text-cyan-300">
                        {selecting ? 'Выбираю...' : 'ВЫБРАТЬ'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
      
      {/* Actions */}
      <div className="flex gap-2 mt-3">
        {!manualSearch && (
          <button
            onClick={() => setManualSearch(true)}
            className="px-4 py-2 text-sm border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white rounded transition"
          >
            🔍 Искать вручную
          </button>
        )}
        {manualSearch && (
          <button
            onClick={() => {
              setManualSearch(false)
              autoSearchSimilarCategories(currentCategoryName)
            }}
            className="px-4 py-2 text-sm border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white rounded transition"
          >
            ← Назад к предложениям
          </button>
        )}
        <button
          onClick={onSkip}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 transition ml-auto"
        >
          Пропустить
        </button>
      </div>
      
      {suggestions.length === 0 && !loading && (
        <div className="mt-3 text-sm text-gray-400 text-center py-4">
          Категории не найдены. Попробуйте ручной поиск.
        </div>
      )}
    </div>
  )
}
