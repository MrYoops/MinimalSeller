import React, { useMemo } from 'react'
import { FiStar, FiAlertCircle } from 'react-icons/fi'
import QuickCategoryMatcher from './QuickCategoryMatcher'

/**
 * Компонент для отображения ВСЕХ характеристик товара
 * Объединяет базовые + маркетплейсовые в ОДНУ таблицу
 * Автоматически синхронизирует значения между всеми источниками
 */
export default function UnifiedMarketplaceCharacteristics({ 
  selectedMarketplaces = {},
  characteristicsByMarketplace = {},
  valuesByMarketplace = {},
  onChange,
  loading = {},
  baseCharacteristics = {},
  currentMappingId = null,
  currentCategoryName = '',
  onMappingUpdated,
  onBaseCharacteristicChange // Новый callback для обновления базовых характеристик
}) {
  
  const mpConfig = {
    wb: { 
      name: 'Wildberries', 
      shortName: 'WB',
      icon: '🟣',
      color: { 
        bg: 'bg-purple-600', 
        text: 'text-purple-400', 
        border: 'border-purple-500',
        badge: 'bg-purple-600/20 text-purple-300 border-purple-500/30'
      }
    },
    ozon: { 
      name: 'Ozon',
      shortName: 'Ozon', 
      icon: '🟠',
      color: { 
        bg: 'bg-blue-600', 
        text: 'text-blue-400', 
        border: 'border-blue-500',
        badge: 'bg-blue-600/20 text-blue-300 border-blue-500/30'
      }
    },
    yandex: { 
      name: 'Яндекс Маркет',
      shortName: 'YM',
      icon: '🟡',
      color: { 
        bg: 'bg-yellow-600', 
        text: 'text-yellow-400', 
        border: 'border-yellow-500',
        badge: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30'
      }
    },
    base: {
      name: 'Базовая',
      shortName: 'Базовая',
      icon: '📦',
      color: {
        badge: 'bg-gray-600/20 text-gray-300 border-gray-500/30'
      }
    }
  }
  
  // Получить список активных маркетплейсов
  const activeMarketplaces = useMemo(() => {
    return Object.keys(selectedMarketplaces).filter(mp => selectedMarketplaces[mp] && characteristicsByMarketplace[mp]?.length > 0)
  }, [selectedMarketplaces, characteristicsByMarketplace])
  
  // ГЛОБАЛЬНЫЙ анализ ВСЕХ характеристик
  const unifiedCharacteristics = useMemo(() => {
    const charMap = new Map()
    
    // 1. Добавляем базовые характеристики
    Object.keys(baseCharacteristics || {}).forEach(charName => {
      if (!charName || !charName.trim()) return
      
      charMap.set(charName, {
        name: charName,
        sources: ['base'],
        requiredIn: [],
        isDictionary: false,
        mpData: {}
      })
    })
    
    // 2. Добавляем характеристики маркетплейсов
    activeMarketplaces.forEach(mp => {
      const chars = characteristicsByMarketplace[mp] || []
      
      chars.forEach(char => {
        const charName = char.name || char.attribute_name || char.charcName
        const charId = char.id || char.attribute_id || char.charcID
        const isRequired = char.is_required || char.required
        const isDictionary = char.dictionary_id > 0 || char.type === 'Dictionary'
        
        if (!charMap.has(charName)) {
          charMap.set(charName, {
            name: charName,
            sources: [],
            requiredIn: [],
            isDictionary: false,
            mpData: {}
          })
        }
        
        const entry = charMap.get(charName)
        
        // Добавляем МП в источники если еще нет
        if (!entry.sources.includes(mp)) {
          entry.sources.push(mp)
        }
        
        // Если хотя бы один МП требует dictionary - используем его
        if (isDictionary) {
          entry.isDictionary = true
        }
        
        // Сохраняем оригинальные данные характеристики для МП
        entry.mpData[mp] = {
          id: charId,
          isRequired,
          originalChar: char
        }
        
        if (isRequired) {
          entry.requiredIn.push(mp)
        }
      })
    })
    
    // Преобразуем Map в массив
    const allChars = Array.from(charMap.values())
    
    // Сортировка: обязательные в начало
    allChars.sort((a, b) => {
      const aHasRequired = a.requiredIn.length > 0
      const bHasRequired = b.requiredIn.length > 0
      
      if (aHasRequired && !bHasRequired) return -1
      if (!aHasRequired && bHasRequired) return 1
      return 0
    })
    
    return allChars
  }, [activeMarketplaces, characteristicsByMarketplace, baseCharacteristics])
  
  // Обработчик изменения - СИНХРОНИЗИРУЕТ значение во все источники
  const handleChange = (charName, value, sources) => {
    console.log(`[Unified] Changing "${charName}" = "${value}" for sources:`, sources)
    
    sources.forEach(source => {
      if (source === 'base') {
        // Обновить базовую характеристику
        if (onBaseCharacteristicChange) {
          onBaseCharacteristicChange(charName, value)
        }
      } else {
        // Обновить характеристику маркетплейса
        if (onChange) {
          const entry = unifiedCharacteristics.find(c => c.name === charName)
          const mpData = entry?.mpData?.[source]
          const charId = mpData?.id || charName
          
          onChange(source, charId, charName, value)
        }
      }
    })
  }
  
  // Получить текущее значение характеристики
  const getCurrentValue = (charName, sources) => {
    // Приоритет: base > первый МП в списке
    if (sources.includes('base') && baseCharacteristics[charName]) {
      return baseCharacteristics[charName]
    }
    
    // Ищем в МП
    for (const mp of sources) {
      if (mp === 'base') continue
      const value = valuesByMarketplace[mp]?.[charName]
      if (value) return value
    }
    
    return ''
  }
  
  const renderCharacteristic = (entry) => {
    const { name, sources, requiredIn, isDictionary } = entry
    
    const currentValue = getCurrentValue(name, sources)
    const isRequired = requiredIn.length > 0
    
    return (
      <div key={name} className="bg-[#1F2937] border border-[#334155] rounded-lg p-3">
        <label className="block text-sm font-medium text-[#E5E7EB] mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {isRequired && <FiStar className="text-red-500 flex-shrink-0" size={12} />}
            <span>{name}</span>
            
            {/* Бейджи источников */}
            <div className="flex items-center gap-1 ml-auto flex-wrap">
              {sources.map(source => {
                if (source === 'base') {
                  const config = mpConfig.base
                  return (
                    <span
                      key={source}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs border rounded ${config.color.badge}`}
                      title="Базовая характеристика"
                    >
                      {config.icon} {config.shortName}
                    </span>
                  )
                }
                
                const config = mpConfig[source]
                const mpData = entry.mpData?.[source]
                const isRequiredHere = mpData?.isRequired
                
                return (
                  <span
                    key={source}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs border rounded ${config.color.badge}`}
                    title={isRequiredHere ? `Обязательно для ${config.name}` : `Для ${config.name}`}
                  >
                    {config.icon} {config.shortName}
                    {isRequiredHere && <FiStar size={8} className="text-red-400" />}
                  </span>
                )
              })}
            </div>
          </div>
        </label>
        
        {isDictionary ? (
          <select
            value={currentValue}
            onChange={(e) => handleChange(name, e.target.value, sources)}
            className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded text-white focus:border-[#22D3EE] focus:ring-2 focus:ring-[#22D3EE]/50 outline-none"
          >
            <option value="">Выберите значение</option>
            {/* TODO: Загрузить значения словаря */}
          </select>
        ) : (
          <input
            type="text"
            value={currentValue}
            onChange={(e) => handleChange(name, e.target.value, sources)}
            className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded text-white focus:border-[#22D3EE] focus:ring-2 focus:ring-[#22D3EE]/50 outline-none"
            placeholder={isRequired ? "Обязательное поле" : "Введите значение"}
          />
        )}
      </div>
    )
  }
  
  // Проверка загрузки
  const isAnyLoading = Object.values(loading).some(v => v)
  
  if (isAnyLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent rounded-full text-[#22D3EE]" role="status">
          <span className="sr-only">Загрузка...</span>
        </div>
        <p className="mt-2 text-gray-400">Загружаю характеристики маркетплейсов...</p>
      </div>
    )
  }
  
  if (activeMarketplaces.length === 0) {
    return (
      <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
        <p className="text-sm text-blue-300 flex items-center gap-2">
          <FiAlertCircle />
          Отметьте галочки маркетплейсов внизу страницы ("Отправить в:"), чтобы загрузить характеристики
        </p>
      </div>
    )
  }
  
  const { common, specific } = analysisResult
  
  const commonRequired = common.filter(c => c.requiredIn.length > 0)
  const commonOptional = common.filter(c => c.requiredIn.length === 0)
  
  // Определяем МП без характеристик (нужно показать QuickMatcher)
  const marketplacesNeedingMapping = activeMarketplaces.filter(mp => {
    const chars = characteristicsByMarketplace[mp] || []
    return chars.length === 0
  })
  
  return (
    <div className="space-y-6">
      {/* БЫСТРЫЙ ВЫБОР КАТЕГОРИИ ДЛЯ МП БЕЗ ХАРАКТЕРИСТИК */}
      {marketplacesNeedingMapping.map(mp => (
        <QuickCategoryMatcher
          key={`matcher-${mp}`}
          marketplace={mp}
          currentMappingId={currentMappingId}
          currentCategoryName={currentCategoryName}
          onCategorySelected={(marketplace, categoryId, categoryName, typeId) => {
            console.log(`[UnifiedCharacteristics] Category selected for ${marketplace}:`, categoryId)
            // Уведомляем родителя что маппинг обновлен
            if (onMappingUpdated) {
              onMappingUpdated(marketplace, categoryId, categoryName, typeId)
            }
          }}
          onSkip={() => {
            console.log(`[UnifiedCharacteristics] Skipped ${mp} category selection`)
          }}
        />
      ))}
      
      {/* ОБЩИЕ ПОЛЯ */}
      {common.length > 0 && (
        <div className="bg-gradient-to-r from-cyan-900/20 to-teal-900/20 border border-cyan-600/30 rounded-lg p-4">
          <div className="flex items-center gap-3 pb-3 border-b border-cyan-600/30 mb-4">
            <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
            <h3 className="text-lg font-bold text-cyan-400">
              📦 ОБЩИЕ ПОЛЯ ДЛЯ ВСЕХ ВЫБРАННЫХ МАРКЕТПЛЕЙСОВ
            </h3>
            <span className="text-sm text-gray-400">
              ({common.length} полей)
            </span>
          </div>
          
          {/* Обязательные общие */}
          {commonRequired.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <FiStar size={12} />
                Обязательные поля ({commonRequired.length})
              </h4>
              <div className="space-y-3">
                {commonRequired.map(entry => renderCharacteristic(entry, 'common'))}
              </div>
            </div>
          )}
          
          {/* Необязательные общие */}
          {commonOptional.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-3">
                Дополнительные поля ({commonOptional.length})
              </h4>
              <div className="space-y-3">
                {commonOptional.map(entry => renderCharacteristic(entry, 'common'))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* СПЕЦИФИЧНЫЕ ПОЛЯ ДЛЯ КАЖДОГО МП */}
      {activeMarketplaces.map(mp => {
        const specificChars = specific[mp] || []
        if (specificChars.length === 0) return null
        
        const config = mpConfig[mp]
        const requiredSpecific = specificChars.filter(c => c.requiredIn.includes(mp))
        const optionalSpecific = specificChars.filter(c => !c.requiredIn.includes(mp))
        
        return (
          <div key={mp} className={`bg-${config.color.bg}/10 border ${config.color.border} border-opacity-30 rounded-lg p-4`}>
            <div className={`flex items-center gap-3 pb-3 border-b ${config.color.border} border-opacity-30 mb-4`}>
              <div className={`w-3 h-3 rounded-full ${config.color.bg}`}></div>
              <h3 className={`text-lg font-bold ${config.color.text}`}>
                {config.icon} ТОЛЬКО ДЛЯ {config.name.toUpperCase()}
              </h3>
              <span className="text-sm text-gray-400">
                ({specificChars.length} полей)
              </span>
              {requiredSpecific.length > 0 && (
                <span className="ml-auto text-xs text-red-400 flex items-center gap-1">
                  <FiStar size={10} />
                  {requiredSpecific.length} обязательных
                </span>
              )}
            </div>
            
            {/* Обязательные специфичные */}
            {requiredSpecific.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                  <FiStar size={12} />
                  Обязательные поля ({requiredSpecific.length})
                </h4>
                <div className="space-y-3">
                  {requiredSpecific.map(entry => renderCharacteristic(entry, 'specific'))}
                </div>
              </div>
            )}
            
            {/* Необязательные специфичные */}
            {optionalSpecific.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-400 mb-3">
                  Дополнительные поля ({optionalSpecific.length})
                </h4>
                <div className="space-y-3">
                  {optionalSpecific.map(entry => renderCharacteristic(entry, 'specific'))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
