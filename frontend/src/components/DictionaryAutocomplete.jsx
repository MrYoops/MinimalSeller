import React, { useState, useEffect, useRef } from 'react'
import { FiChevronDown, FiSearch } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

/**
 * Автокомплит для dictionary атрибутов
 * Поддерживает поиск, фильтрацию и выбор из большого списка значений
 */
export default function DictionaryAutocomplete({ 
  marketplace,
  categoryId,
  typeId,
  attributeId,
  attributeName,
  value,
  onChange,
  placeholder = "Начните вводить..."
}) {
  const { api } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [allValues, setAllValues] = useState([])
  const [filteredValues, setFilteredValues] = useState([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(null)
  const containerRef = useRef(null)

  // Load dictionary values
  useEffect(() => {
    if (categoryId && attributeId) {
      loadDictionaryValues()
    }
  }, [categoryId, attributeId, typeId])

  // Filter values when search term changes
  useEffect(() => {
    if (!searchTerm) {
      setFilteredValues(allValues.slice(0, 50)) // Show first 50
    } else {
      const filtered = allValues.filter(item => {
        const itemValue = item.value || ''
        return itemValue.toLowerCase().includes(searchTerm.toLowerCase())
      })
      setFilteredValues(filtered.slice(0, 50)) // Max 50 results
    }
  }, [searchTerm, allValues])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Update search term when value changes externally
  useEffect(() => {
    if (value && allValues.length > 0) {
      const found = allValues.find(item => item.id === value || item.value === value)
      if (found) {
        setSelectedValue(found)
        setSearchTerm(found.value)
      }
    }
  }, [value, allValues])

  const loadDictionaryValues = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        attribute_id: attributeId,
      })
      
      if (typeId) {
        params.append('type_id', typeId)
      }

      const response = await api.get(
        `/api/categories/marketplace/${marketplace}/${categoryId}/attribute-values?${params}`
      )
      
      const values = response.data.values || []
      setAllValues(values)
      setFilteredValues(values.slice(0, 50))
      
      console.log(`[DictionaryAutocomplete] Loaded ${values.length} values for ${attributeName}`)
    } catch (error) {
      console.error('Failed to load dictionary values:', error)
      setAllValues([])
    }
    setLoading(false)
  }

  const handleSelect = (item) => {
    setSelectedValue(item)
    setSearchTerm(item.value)
    setIsOpen(false)
    
    // Вызвать onChange с value_id и value
    onChange({
      value_id: item.id,
      value: item.value
    })
  }

  const handleInputChange = (e) => {
    const newValue = e.target.value
    setSearchTerm(newValue)
    setIsOpen(true)
    
    // Если пользователь печатает произвольное значение
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  const handleInputFocus = () => {
    setIsOpen(true)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Input field */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded text-white focus:border-[#22D3EE] focus:ring-2 focus:ring-[#22D3EE]/50 outline-none pr-10"
          disabled={loading}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {loading && (
            <div className="animate-spin w-4 h-4 border-2 border-[#22D3EE] border-t-transparent rounded-full" />
          )}
          <FiChevronDown className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown list */}
      {isOpen && !loading && filteredValues.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#1E293B] border border-[#334155] rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {filteredValues.map((item, index) => (
            <button
              key={item.id || index}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full text-left px-3 py-2 hover:bg-[#22D3EE]/10 text-white text-sm border-b border-[#334155] last:border-b-0 transition-colors"
            >
              {item.value}
              {item.info && (
                <span className="text-xs text-gray-400 ml-2">({item.info})</span>
              )}
            </button>
          ))}
          
          {allValues.length > 50 && (
            <div className="px-3 py-2 text-xs text-gray-400 bg-[#0F172A] border-t border-[#334155]">
              Показано {filteredValues.length} из {allValues.length}. Продолжайте вводить для уточнения поиска.
            </div>
          )}
        </div>
      )}

      {/* No results */}
      {isOpen && !loading && searchTerm && filteredValues.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#1E293B] border border-[#334155] rounded-lg shadow-xl p-3">
          <p className="text-sm text-gray-400">Ничего не найдено</p>
        </div>
      )}

      {/* Info text */}
      {allValues.length > 0 && !isOpen && (
        <p className="text-xs text-gray-500 mt-1">
          Доступно {allValues.length} вариантов. Начните вводить для поиска.
        </p>
      )}
    </div>
  )
}
