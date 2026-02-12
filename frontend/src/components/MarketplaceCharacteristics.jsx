import React from 'react'
import { FiStar, FiAlertCircle } from 'react-icons/fi'

export default function MarketplaceCharacteristics({ 
  marketplace, 
  characteristics, 
  values = {}, 
  onChange, 
  loading = false 
}) {
  
  const mpNames = {
    wb: 'Wildberries',
    ozon: 'Ozon',
    yandex: 'Яндекс Маркет'
  }
  
  const mpColors = {
    wb: { bg: 'bg-purple-600', text: 'text-purple-400', border: 'border-purple-500' },
    ozon: { bg: 'bg-blue-600', text: 'text-blue-400', border: 'border-blue-500' },
    yandex: { bg: 'bg-yellow-600', text: 'text-yellow-400', border: 'border-yellow-500' }
  }
  
  const color = mpColors[marketplace] || mpColors.ozon
  
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent rounded-full" role="status">
          <span className="sr-only">Загрузка...</span>
        </div>
        <p className="mt-2 text-gray-400">Загружаю характеристики {mpNames[marketplace]}...</p>
      </div>
    )
  }
  
  if (!characteristics || characteristics.length === 0) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FiAlertCircle className="mt-0.5 flex-shrink-0 text-yellow-400" size={20} />
          <div className="flex-1">
            <p className="text-yellow-200 text-sm mb-2">
              Категория товара не сопоставлена с {mpNames[marketplace]}
            </p>
            <p className="text-yellow-200/70 text-xs mb-3">
              Для загрузки характеристик необходимо создать или обновить сопоставление категории, добавив категорию {mpNames[marketplace]}.
            </p>
            <a
              href="/catalog/categories"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition"
            >
              Перейти к сопоставлениям
            </a>
          </div>
        </div>
      </div>
    )
  }
  
  const handleChange = (charId, charName, value) => {
    if (onChange) {
      onChange(marketplace, charId, charName, value)
    }
  }
  
  // Группировка: обязательные и опциональные
  const required = characteristics.filter(c => c.is_required || c.required)
  const optional = characteristics.filter(c => !c.is_required && !c.required)
  
  const renderCharacteristic = (char) => {
    const charId = char.id || char.attribute_id || char.charcID
    const charName = char.name || char.attribute_name || char.charcName
    const isRequired = char.is_required || char.required
    const isDictionary = char.dictionary_id > 0 || char.type === 'Dictionary'
    
    // Текущее значение
    const currentValue = values[charName] || ''
    
    return (
      <div key={charId} className={`bg-[#1F2937] border ${color.border} border-opacity-30 rounded-lg p-3`}>
        <label className="block text-sm font-medium text-[#E5E7EB] mb-2 flex items-center gap-2">
          {isRequired && <FiStar className="text-red-500" size={12} />}
          {charName}
          {isDictionary && <span className="text-xs text-gray-500">(словарь)</span>}
        </label>
        
        {isDictionary ? (
          <select
            value={currentValue}
            onChange={(e) => handleChange(charId, charName, e.target.value)}
            className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded text-white focus:border-[#22D3EE] focus:ring-2 focus:ring-[#22D3EE]/50 outline-none"
          >
            <option value="">Выберите значение</option>
            {/* TODO: Загрузить значения словаря */}
          </select>
        ) : (
          <input
            type="text"
            value={currentValue}
            onChange={(e) => handleChange(charId, charName, e.target.value)}
            className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded text-white focus:border-[#22D3EE] focus:ring-2 focus:ring-[#22D3EE]/50 outline-none"
            placeholder={isRequired ? "Обязательное поле" : "Введите значение"}
          />
        )}
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`flex items-center gap-3 pb-3 border-b ${color.border} border-opacity-30`}>
        <div className={`w-3 h-3 rounded-full ${color.bg}`}></div>
        <h3 className={`text-lg font-bold ${color.text}`}>
          {mpNames[marketplace]}
        </h3>
        <span className="text-sm text-gray-400">
          ({characteristics.length} характеристик)
        </span>
        {required.length > 0 && (
          <span className="ml-auto text-xs text-red-400 flex items-center gap-1">
            <FiStar size={10} />
            {required.length} обязательных
          </span>
        )}
      </div>
      
      {/* Обязательные */}
      {required.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
            <FiStar size={12} />
            Обязательные поля ({required.length})
          </h4>
          <div className="space-y-3">
            {required.map(renderCharacteristic)}
          </div>
        </div>
      )}
      
      {/* Опциональные */}
      {optional.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 mb-3">
            Дополнительные поля ({optional.length})
          </h4>
          <div className="space-y-3">
            {optional.map(renderCharacteristic)}
          </div>
        </div>
      )}
    </div>
  )
}
