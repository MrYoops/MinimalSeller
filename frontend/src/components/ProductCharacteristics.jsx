import React from 'react'
import { FiStar } from 'react-icons/fi'

export default function ProductCharacteristics({ characteristics, onChange, readonly = false }) {
  if (!characteristics || Object.keys(characteristics).length === 0) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
        <p className="text-yellow-200 text-sm">
          ℹ️ Характеристики не загружены. Выберите категорию чтобы загрузить характеристики автоматически.
        </p>
      </div>
    )
  }

  const handleChange = (key, value) => {
    if (onChange) {
      onChange({
        ...characteristics,
        [key]: value
      })
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400 mb-4">
        {Object.keys(characteristics).length} характеристик
      </p>

      {Object.entries(characteristics).map(([key, value]) => {
        // Value может быть массивом или строкой/числом
        const displayValue = Array.isArray(value) ? value.join(', ') : value
        const isRequired = false // TODO: добавить логику обязательных полей

        return (
          <div key={key} className="bg-[#1F2937] border border-[#334155] rounded-lg p-3">
            <label className="block text-sm font-medium text-[#A7AFB8] mb-2 flex items-center gap-2">
              {isRequired && <FiStar className="text-red-500" size={12} />}
              {key}
            </label>
            
            {readonly ? (
              <div className="text-white">
                {displayValue || '-'}
              </div>
            ) : (
              <input
                type="text"
                value={displayValue || ''}
                onChange={(e) => {
                  // Если было массив, делаем массив, иначе строку
                  const newValue = Array.isArray(value) 
                    ? e.target.value.split(',').map(v => v.trim())
                    : e.target.value
                  handleChange(key, newValue)
                }}
                className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded text-white focus:border-[#22D3EE] focus:ring-2 focus:ring-[#22D3EE]/50 outline-none"
                placeholder={Array.isArray(value) ? "Значения через запятую" : "Введите значение"}
              />
            )}
            
            {Array.isArray(value) && (
              <p className="text-xs text-gray-500 mt-1">
                Несколько значений разделите запятыми
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
