import React, { useState, useEffect } from 'react'
import { FiSearch, FiCheck, FiAlertCircle } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

/**
 * Компонент для выбора категории маркетплейса и динамического отображения обязательных полей
 * Реплицирует логику SelSup
 */
export default function MarketplaceCategorySelector({ 
  marketplace, 
  value, 
  onChange, 
  onAttributesChange,
  requiredAttributes = {}
}) {
  const { api } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [attributes, setAttributes] = useState([])
  const [attributeValues, setAttributeValues] = useState({}) // Кэш для значений атрибутов
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Загрузить категорию если уже выбрана
  useEffect(() => {
    if (value && value.category_id) {
      setSelectedCategory({
        id: value.category_id,
        name: value.category_name,
        type_id: value.type_id
      })
      
      // Загрузить атрибуты
      loadCategoryAttributes(value.category_id, value.type_id)
    }
  }, [value])

  // Поиск категорий с debounce
  const searchCategories = async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await api.get(`/api/categories/search/${marketplace}?query=${encodeURIComponent(query)}`)
      const categories = response.data.categories || []
      console.log(`[CategorySelector] Found ${categories.length} categories for "${query}"`)
      setSearchResults(categories)
    } catch (err) {
      console.error('Failed to search categories:', err)
      setError(err.response?.data?.detail || 'Ошибка поиска категорий')
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }
  
  // Debounce для поиска
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

  // Выбор категории
  const selectCategory = async (category) => {
    setSelectedCategory(category)
    setSearchQuery('')
    setSearchResults([])

    // Уведомить родительский компонент
    onChange({
      category_id: category.id,
      category_name: category.name,
      type_id: category.type_id
    })

    // Загрузить обязательные атрибуты
    if (marketplace === 'ozon' && category.type_id) {
      await loadCategoryAttributes(category.id, category.type_id)
    } else if (marketplace === 'wb') {
      await loadCategoryAttributes(category.id)
    }
  }

  // Загрузить обязательные атрибуты для категории
  const loadCategoryAttributes = async (categoryId, typeId = null) => {
    setLoading(true)
    setError(null)

    try {
      let url = `/api/categories/${marketplace}/${categoryId}/attributes`
      if (typeId) {
        url += `?type_id=${typeId}`
      }

      const response = await api.get(url)
      const attrs = response.data.attributes || []
      
      // Фильтровать только обязательные и dictionary-атрибуты
      const requiredAttrs = attrs.filter(attr => 
        attr.is_required || attr.dictionary_id > 0
      )
      
      setAttributes(requiredAttrs)

      // Загрузить значения для dictionary-атрибутов
      for (const attr of requiredAttrs) {
        if (attr.dictionary_id > 0 && attr.attribute_id) {
          await loadAttributeValues(categoryId, attr.attribute_id, typeId)
        }
      }
    } catch (err) {
      console.error('Failed to load attributes:', err)
      setError(err.response?.data?.detail || 'Ошибка загрузки атрибутов')
    } finally {
      setLoading(false)
    }
  }

  // Загрузить возможные значения для dictionary-атрибута
  const loadAttributeValues = async (categoryId, attributeId, typeId = null) => {
    try {
      let url = `/api/categories/${marketplace}/${categoryId}/attribute-values?attribute_id=${attributeId}`
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
    const newAttributes = {
      ...requiredAttributes,
      [attributeId]: valueId ? { value, value_id: valueId } : value
    }

    onAttributesChange(newAttributes)
  }

  return (
    <div className="space-y-4">
      {/* Поиск категории */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Категория {marketplace.toUpperCase()}
          {selectedCategory && (
            <span className="ml-2 text-xs text-green-600">
              <FiCheck className="inline mr-1" />
              Выбрана: {selectedCategory.name}
            </span>
          )}
        </label>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              searchCategories(e.target.value)
            }}
            placeholder="Начните вводить название категории..."
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <FiSearch className="absolute left-3 top-3 text-gray-400" />
        </div>

        {/* Результаты поиска */}
        {searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {searchResults.map((category) => (
              <button
                key={category.id}
                onClick={() => selectCategory(category)}
                className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-gray-900">{category.name}</div>
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

      {/* Обязательные характеристики */}
      {attributes.length > 0 && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <FiAlertCircle className="text-orange-500" />
            <h4 className="font-medium text-gray-900">
              Обязательные характеристики ({attributes.length})
            </h4>
          </div>

          <div className="space-y-3">
            {attributes.map((attr) => {
              const values = attributeValues[attr.attribute_id] || []
              const currentValue = requiredAttributes[attr.attribute_id]

              return (
                <div key={attr.attribute_id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {attr.name}
                    {attr.is_required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>

                  {/* Dictionary-атрибут - выпадающий список */}
                  {values.length > 0 ? (
                    <select
                      value={typeof currentValue === 'object' ? currentValue.value_id : currentValue || ''}
                      onChange={(e) => {
                        const selectedValue = values.find(v => String(v.id) === e.target.value)
                        if (selectedValue) {
                          handleAttributeChange(
                            attr.attribute_id,
                            selectedValue.value,
                            selectedValue.id
                          )
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Выберите --</option>
                      {values.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.value}
                        </option>
                      ))}
                    </select>
                  ) : (
                    /* Текстовый атрибут */
                    <input
                      type="text"
                      value={typeof currentValue === 'object' ? currentValue.value : currentValue || ''}
                      onChange={(e) => handleAttributeChange(attr.attribute_id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder={`Введите ${attr.name.toLowerCase()}`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
