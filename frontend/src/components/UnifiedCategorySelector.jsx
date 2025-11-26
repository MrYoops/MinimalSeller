import React, { useState, useEffect } from 'react'
import { FiSearch, FiCheck, FiAlertCircle, FiRefreshCw } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

/**
 * Единый селектор категории для товара
 * После выбора категории подгружает характеристики для выбранных маркетплейсов
 */
export default function UnifiedCategorySelector({ 
  productName = '',
  selectedMarketplaces = [], // ['ozon', 'wb', 'yandex']
  onCategorySelected,
  onAttributesLoaded
}) {
  const { api } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [allAttributes, setAllAttributes] = useState({}) // По маркетплейсам
  const [attributeValues, setAttributeValues] = useState({}) // Кэш значений
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Цвета маркетплейсов
  const mpColors = {
    ozon: { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
    wb: { border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
    yandex: { border: 'border-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' }
  }

  const mpNames = {
    ozon: 'Ozon',
    wb: 'Wildberries',
    yandex: 'Яндекс'
  }

  // Автопоиск при вводе названия товара
  useEffect(() => {
    if (productName && productName.length > 3 && !selectedCategory) {
      console.log(`[UnifiedCategory] Auto-suggesting for: "${productName}"`)
      setSearchQuery(productName)
    }
  }, [productName, selectedCategory])

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    
    const timeoutId = setTimeout(() => {
      searchCategories()
    }, 500)
    
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const searchCategories = async () => {
    setLoading(true)
    setError(null)

    try {
      // Поиск по сопоставлениям (mappings)
      const response = await api.get(`/api/categories/mappings/search?query=${encodeURIComponent(searchQuery)}`)
      const mappings = response.data.mappings || []
      
      console.log(`[UnifiedCategory] Found ${mappings.length} category mappings`)
      setSearchResults(mappings)
    } catch (err) {
      console.error('Search error:', err)
      setError('Ошибка поиска категорий')
    } finally {
      setLoading(false)
    }
  }

  const selectCategory = async (mapping) => {
    console.log('[UnifiedCategory] Selected mapping:', mapping)
    setSelectedCategory(mapping)
    setSearchQuery('')
    setSearchResults([])

    // Уведомить родителя
    onCategorySelected(mapping)

    // Загрузить атрибуты для всех выбранных маркетплейсов
    await loadAttributesForMarketplaces(mapping)
  }

  const loadAttributesForMarketplaces = async (mapping) => {
    setLoading(true)
    const newAttributes = {}

    for (const mp of selectedMarketplaces) {
      const categoryId = mapping.marketplace_categories?.[mp]
      
      if (!categoryId) {
        console.log(`[UnifiedCategory] No category mapped for ${mp}`)
        continue
      }

      try {
        // Для Ozon нужен type_id
        let url = `/api/categories/marketplace/${mp}/${categoryId}/attributes`
        
        if (mp === 'ozon' && mapping.marketplace_type_ids?.ozon) {
          url += `?type_id=${mapping.marketplace_type_ids.ozon}`
        }

        const response = await api.get(url)
        const attrs = response.data.attributes || []
        
        console.log(`[UnifiedCategory] Loaded ${attrs.length} attributes for ${mp}`)
        newAttributes[mp] = attrs

        // Загрузить значения для dictionary-атрибутов
        for (const attr of attrs) {
          if (attr.dictionary_id > 0 || attr.type === 'Dictionary') {
            const attrId = attr.attribute_id || attr.id
            const typeId = mp === 'ozon' ? mapping.marketplace_type_ids?.ozon : null
            await loadAttributeValues(mp, categoryId, attrId, typeId)
          }
        }
      } catch (err) {
        console.error(`Failed to load attributes for ${mp}:`, err)
      }
    }

    setAllAttributes(newAttributes)
    onAttributesLoaded(newAttributes)
    setLoading(false)
  }

  const loadAttributeValues = async (marketplace, categoryId, attributeId, typeId = null) => {
    try {
      let url = `/api/categories/marketplace/${marketplace}/${categoryId}/attribute-values?attribute_id=${attributeId}`
      if (typeId) {
        url += `&type_id=${typeId}`
      }
      
      const response = await api.get(url)
      const values = response.data.values || []

      setAttributeValues(prev => ({
        ...prev,
        [`${marketplace}_${attributeId}`]: values
      }))
    } catch (err) {
      console.error(`Failed to load values for ${marketplace} attribute ${attributeId}:`, err)
    }
  }

  // Объединённый список атрибутов (все маркетплейсы)
  const getMergedAttributes = () => {
    const merged = []
    const seen = new Map() // name -> {attr, marketplaces}

    for (const mp of selectedMarketplaces) {
      const attrs = allAttributes[mp] || []
      
      for (const attr of attrs) {
        const attrName = attr.name || attr.attribute_name || ''
        const attrId = attr.attribute_id || attr.id
        
        if (seen.has(attrName)) {
          // Атрибут уже есть, добавим маркетплейс
          const existing = seen.get(attrName)
          if (!existing.marketplaces.includes(mp)) {
            existing.marketplaces.push(mp)
          }
          if (attr.is_required) {
            existing.required_for.push(mp)
          }
        } else {
          // Новый атрибут
          seen.set(attrName, {
            ...attr,
            original_mp: mp, // Первый маркетплейс где встретился
            marketplaces: [mp],
            required_for: attr.is_required ? [mp] : []
          })
        }
      }
    }

    return Array.from(seen.values())
  }

  const mergedAttributes = getMergedAttributes()

  return (
    <div className="space-y-6">
      {/* Category Search */}
      <div className="bg-mm-secondary border border-mm-border rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          КАТЕГОРИЯ <span className="text-red-400">*</span>
        </label>
        
        {selectedCategory ? (
          <div className="flex items-center justify-between bg-green-900/30 border border-green-500/50 rounded-lg p-3">
            <div>
              <p className="text-green-400 font-medium flex items-center gap-2">
                <FiCheck /> {selectedCategory.internal_name}
              </p>
              <div className="flex gap-2 mt-2">
                {Object.entries(selectedCategory.marketplace_categories || {}).map(([mp, catId]) => {
                  if (!catId) return null
                  const colors = mpColors[mp]
                  return (
                    <span key={mp} className={`text-xs px-2 py-1 rounded font-medium ${colors?.badge || 'bg-gray-700 text-gray-300'}`}>
                      {mpNames[mp]?.toUpperCase()}
                    </span>
                  )
                })}
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedCategory(null)
                setAllAttributes({})
              }}
              className="text-gray-400 hover:text-white px-3 py-1 bg-gray-800 rounded border border-gray-700 hover:border-gray-600"
            >
              Изменить
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Начните вводить название категории..."
                className="w-full px-4 py-3 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-mm-cyan focus:ring-2 focus:ring-mm-cyan/50 outline-none"
              />
              <FiSearch className="absolute left-3 top-3.5 text-gray-500" />
            </div>

            {/* Search Results Dropdown */}
            {searchQuery.length >= 2 && (
              <div className="absolute z-50 mt-2 w-full bg-gray-800 border-2 border-mm-cyan rounded-lg shadow-2xl max-h-80 overflow-hidden">
                {loading ? (
                  <div className="p-6 text-center">
                    <FiRefreshCw className="animate-spin inline text-2xl text-mm-cyan mb-2" />
                    <p className="text-sm text-gray-400">Поиск категорий...</p>
                  </div>
                ) : error ? (
                  <div className="p-6 text-center">
                    <FiAlertCircle className="inline text-2xl text-red-400 mb-2" />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  <>
                    <div className="bg-gray-900 px-4 py-2 border-b border-gray-700">
                      <p className="text-xs text-mm-cyan font-medium">
                        Найдено категорий: {searchResults.length}
                      </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {searchResults.map((mapping, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectCategory(mapping)}
                          className="w-full px-4 py-3 text-left hover:bg-mm-cyan/20 border-b border-gray-700 last:border-b-0 transition-colors focus:bg-mm-cyan/30 focus:outline-none"
                        >
                          <p className="font-medium text-white mb-1">{mapping.internal_name}</p>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {Object.entries(mapping.marketplace_categories || {}).map(([mp, catId]) => {
                              if (!catId) return null
                              const colors = mpColors[mp]
                              return (
                                <span key={mp} className={`text-xs px-2 py-0.5 rounded font-medium ${colors?.badge || 'bg-gray-700 text-gray-300'}`}>
                                  {mpNames[mp]}
                                </span>
                              )
                            })}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-center">
                    <FiSearch className="inline text-3xl text-gray-600 mb-2" />
                    <p className="text-sm text-gray-400 mb-2">Категории не найдены</p>
                    <p className="text-xs text-gray-500">
                      Попробуйте изменить запрос или создайте новое сопоставление
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Attributes (after category selected) */}
      {selectedCategory && mergedAttributes.length > 0 && (
        <div className="bg-mm-secondary border border-mm-border rounded-lg p-4">
          <h3 className="font-bold text-mm-cyan mb-4">
            Характеристики ({mergedAttributes.length})
          </h3>
          
          <div className="space-y-3">
            {mergedAttributes.map((attr, idx) => {
              const attrId = attr.attribute_id || attr.id
              const attrName = attr.name || attr.attribute_name || ''
              const primaryMp = attr.original_mp
              const colors = mpColors[primaryMp]
              const isRequired = attr.required_for.length > 0

              // Получить значения для выпадающего списка
              const valuesKey = `${primaryMp}_${attrId}`
              const values = attributeValues[valuesKey] || []

              return (
                <div 
                  key={idx}
                  className={`p-3 rounded border-l-4 ${colors.border} ${colors.bg}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <label className={`block text-sm font-medium ${colors.text}`}>
                      {attrName}
                      {isRequired && <span className="text-red-600 ml-1 text-lg">*</span>}
                    </label>
                    
                    {/* Бейджи маркетплейсов */}
                    <div className="flex gap-1">
                      {attr.marketplaces.map(mp => {
                        const mpColor = mpColors[mp]
                        const mpIsRequired = attr.required_for.includes(mp)
                        
                        return (
                          <span 
                            key={mp}
                            className={`text-xs px-2 py-0.5 rounded font-medium ${mpColor.badge}`}
                            title={mpIsRequired ? `Обязательно для ${mpNames[mp]}` : mpNames[mp]}
                          >
                            {mpNames[mp]}
                            {mpIsRequired && ' *'}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  {/* Input Field */}
                  {values.length > 0 ? (
                    <select
                      className={`w-full px-3 py-2 border rounded focus:ring-2 outline-none ${
                        isRequired 
                          ? 'border-red-300 focus:ring-red-500 bg-red-50' 
                          : 'border-gray-300 focus:ring-blue-500 bg-white'
                      }`}
                      required={isRequired}
                    >
                      <option value="">
                        {isRequired ? '⚠️ Обязательно выберите' : 'Выберите значение'}
                      </option>
                      {values.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.value}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder={isRequired ? `⚠️ Обязательно укажите` : 'Введите значение'}
                      className={`w-full px-3 py-2 border rounded focus:ring-2 outline-none ${
                        isRequired 
                          ? 'border-red-300 focus:ring-red-500 bg-red-50' 
                          : 'border-gray-300 focus:ring-blue-500 bg-white'
                      }`}
                      required={isRequired}
                    />
                  )}

                  {/* Description if available */}
                  {attr.description && (
                    <p className="text-xs text-gray-500 mt-1">{attr.description}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="border-t border-mm-border pt-3 mt-4">
            <p className="text-xs text-mm-text-secondary mb-2">Легенда:</p>
            <div className="flex gap-3 text-xs text-mm-text-secondary">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 border-2 border-blue-500 rounded"></div>
                <span>Ozon</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 border-2 border-purple-500 rounded"></div>
                <span>Wildberries</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 border-2 border-yellow-500 rounded"></div>
                <span>Яндекс</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-red-600 font-bold">*</span>
                <span>Обязательное</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
