import React, { useState, useEffect } from 'react'
import { FiSearch, FiCheck, FiAlertCircle, FiTag } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

/**
 * Компонент для выбора категории маркетплейса V2
 * С предзагруженными категориями и цветовой индикацией атрибутов
 */
export default function MarketplaceCategorySelectorV2({ 
  marketplace, 
  productName = '',
  selectedMarketplaces = ['ozon', 'wb', 'yandex'],
  allMarketplaceCategories = {},
  onCategoryChange,
  onAttributesChange
}) {
  const { api } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [allAttributes, setAllAttributes] = useState([]) // Все атрибуты из всех маркетплейсов
  const [attributesByMarketplace, setAttributesByMarketplace] = useState({}) // Группировка по МП
  const [attributeValues, setAttributeValues] = useState({}) // Кэш значений
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Цвета для маркетплейсов
  const marketplaceColors = {
    ozon: { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100' },
    wb: { border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100' },
    yandex: { border: 'border-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700', badge: 'bg-yellow-100' }
  }

  const marketplaceNames = {
    ozon: 'Ozon',
    wb: 'Wildberries',
    yandex: 'Яндекс Маркет'
  }

  // Автопоиск категории по названию товара
  useEffect(() => {
    if (productName && productName.length > 3 && !selectedCategory) {
      console.log(`[CategoryV2] Auto-suggesting category for: "${productName}"`)
      setSearchQuery(productName)
    }
  }, [productName, selectedCategory])

  // Поиск категорий с debounce (в предзагруженных данных)
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    
    const timeoutId = setTimeout(() => {
      searchCategories(searchQuery)
    }, 500)
    
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const searchCategories = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Используем новый API с предзагруженными категориями
      const response = await api.get(`/api/categories/marketplace/${marketplace}/search?query=${encodeURIComponent(query)}`)
      const categories = response.data.categories || []
      console.log(`[CategoryV2] Found ${categories.length} preloaded categories`)
      setSearchResults(categories)
    } catch (err) {
      console.error('Failed to search categories:', err)
      setError(err.response?.data?.detail || 'Ошибка поиска категорий')
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }

  // Выбор категории
  const selectCategory = async (category) => {
    setSelectedCategory(category)
    setSearchQuery('')
    setSearchResults([])

    // Уведомить родителя
    onCategoryChange(marketplace, {
      category_id: category.category_id,
      category_name: category.category_name,
      type_id: category.type_id
    })

    // Загрузить атрибуты для выбранной категории
    await loadCategoryAttributes(category.category_id, category.type_id)
  }

  // Загрузить атрибуты категории
  const loadCategoryAttributes = async (categoryId, typeId = null) => {
    setLoading(true)
    setError(null)

    try {
      let url = `/api/categories/marketplace/${marketplace}/${categoryId}/attributes`
      if (typeId) {
        url += `?type_id=${typeId}`
      }

      const response = await api.get(url)
      const attrs = response.data.attributes || []
      
      console.log(`[CategoryV2] Loaded ${attrs.length} attributes for ${marketplace}`)
      
      // Сохранить атрибуты для этого маркетплейса
      setAttributesByMarketplace(prev => ({
        ...prev,
        [marketplace]: attrs
      }))

      // Объединить атрибуты из всех маркетплейсов
      mergeAllAttributes()

      // Загрузить значения для dictionary-атрибутов
      for (const attr of attrs) {
        if (attr.dictionary_id > 0 || attr.type === 'Dictionary') {
          await loadAttributeValues(categoryId, attr.attribute_id || attr.id, typeId)
        }
      }
    } catch (err) {
      console.error('Failed to load attributes:', err)
      setError(err.response?.data?.detail || 'Ошибка загрузки атрибутов')
    } finally {
      setLoading(false)
    }
  }

  // Объединить атрибуты из всех выбранных маркетплейсов
  const mergeAllAttributes = () => {
    const merged = []
    const seen = new Set()

    // Пройти по всем выбранным маркетплейсам
    for (const mp of selectedMarketplaces) {
      const mpAttrs = attributesByMarketplace[mp] || []
      
      for (const attr of mpAttrs) {
        const attrKey = attr.name || attr.attribute_name
        
        if (!seen.has(attrKey)) {
          merged.push({
            ...attr,
            marketplaces: [mp], // Какие маркетплейсы используют этот атрибут
            is_required_for: mpAttrs.find(a => a.name === attrKey)?.is_required ? [mp] : []
          })
          seen.add(attrKey)
        } else {
          // Атрибут уже есть, добавим маркетплейс
          const existing = merged.find(a => (a.name || a.attribute_name) === attrKey)
          if (existing && !existing.marketplaces.includes(mp)) {
            existing.marketplaces.push(mp)
            
            if (attr.is_required && !existing.is_required_for.includes(mp)) {
              existing.is_required_for.push(mp)
            }
          }
        }
      }
    }

    setAllAttributes(merged)
  }

  // Загрузить возможные значения для dictionary-атрибута
  const loadAttributeValues = async (categoryId, attributeId, typeId = null) => {
    try {
      let url = `/api/categories/marketplace/${marketplace}/${categoryId}/attribute-values?attribute_id=${attributeId}`
      if (typeId) {
        url += `&type_id=${typeId}`
      }

      const response = await api.get(url)
      const values = response.data.values || []

      setAttributeValues(prev => ({
        ...prev,
        [attributeId]: values
      }))
    } catch (err) {
      console.error(`Failed to load values for attribute ${attributeId}:`, err)
    }
  }

  // Обработать изменение значения атрибута
  const handleAttributeChange = (attributeId, value, valueId = null) => {
    onAttributesChange(marketplace, attributeId, {
      value,
      value_id: valueId
    })
  }

  // Проверить является ли атрибут обязательным для текущего выбранного МП
  const isRequiredForCurrentMarketplace = (attr) => {
    return attr.is_required_for && attr.is_required_for.includes(marketplace)
  }

  return (
    <div className="space-y-4">
      {/* Поиск категории */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Категория {marketplaceNames[marketplace]}
          {selectedCategory ? (
            <span className="ml-2 text-xs text-green-600">
              <FiCheck className="inline mr-1" />
              Выбрана: {selectedCategory.category_name}
            </span>
          ) : (
            <span className="ml-2 text-xs text-blue-600">
              💡 Начните вводить название для поиска
            </span>
          )}
        </label>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск категории..."
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <FiSearch className="absolute left-3 top-3 text-gray-400" />
        </div>

        {/* Результаты поиска */}
        {searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {searchResults.map((category, idx) => (
              <button
                key={idx}
                onClick={() => selectCategory(category)}
                className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-gray-900">{category.category_name}</div>
                {category.type_name && (
                  <div className="text-xs text-gray-500 mt-1">
                    Тип: {category.type_name}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="text-sm text-gray-500 mt-2">
            Загрузка...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
            <FiAlertCircle />
            {error}
          </div>
        )}
      </div>

      {/* Атрибуты с цветовой индикацией */}
      {allAttributes.length > 0 && (
        <div className="border-t pt-4 mt-4">
          <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <FiTag />
            Характеристики ({allAttributes.length})
          </h4>
          <p className="text-sm text-gray-600 mb-4">
            Атрибуты подсвечены цветом по маркетплейсам. Обязательные поля отмечены красной звездой.
          </p>

          <div className="space-y-3">
            {allAttributes.map((attr, idx) => {
              const attrId = attr.attribute_id || attr.id
              const attrName = attr.name || attr.attribute_name
              const values = attributeValues[attrId] || []
              const isRequired = isRequiredForCurrentMarketplace(attr)
              
              // Определить основной цвет (первый маркетплейс в списке)
              const primaryMp = attr.marketplaces[0]
              const colors = marketplaceColors[primaryMp]

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
                        const mpColor = marketplaceColors[mp]
                        const mpIsRequired = attr.is_required_for && attr.is_required_for.includes(mp)
                        
                        return (
                          <span 
                            key={mp}
                            className={`text-xs px-2 py-0.5 rounded ${mpColor.badge} ${mpColor.text} font-medium`}
                            title={mpIsRequired ? `Обязательно для ${marketplaceNames[mp]}` : marketplaceNames[mp]}
                          >
                            {mp.toUpperCase()}
                            {mpIsRequired && ' *'}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  {/* Поле ввода */}
                  {values.length > 0 ? (
                    <select
                      onChange={(e) => {
                        const selectedValue = values.find(v => String(v.id) === e.target.value)
                        if (selectedValue) {
                          handleAttributeChange(attrId, selectedValue.value, selectedValue.id)
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 ${
                        isRequired ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      required={isRequired}
                    >
                      <option value="">{isRequired ? '⚠️ Обязательно выберите' : 'Выберите значение'}</option>
                      {values.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.value}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      onChange={(e) => handleAttributeChange(attrId, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 ${
                        isRequired ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      placeholder={isRequired ? `⚠️ Обязательно укажите ${attrName.toLowerCase()}` : `Укажите ${attrName.toLowerCase()}`}
                      required={isRequired}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Легенда */}
      {allAttributes.length > 0 && (
        <div className="border-t pt-3 mt-3">
          <p className="text-xs text-gray-500 mb-2">Легенда:</p>
          <div className="flex gap-3 text-xs">
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
              <span className="text-red-600 text-base">*</span>
              <span>Обязательное поле</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
