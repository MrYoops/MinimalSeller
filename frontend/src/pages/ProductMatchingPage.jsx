import React, { useState, useEffect } from 'react'
import { FiRefreshCw, FiLink, FiCheck, FiX, FiSearch, FiFilter } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'

export default function ProductMatchingPage() {
  const { api } = useAuth()
  const [selectedMarketplace, setSelectedMarketplace] = useState('ozon')
  const [integrations, setIntegrations] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Товары
  const [mpProducts, setMpProducts] = useState([])
  const [localProducts, setLocalProducts] = useState([])
  
  // Сопоставленные и несопоставленные
  const [matched, setMatched] = useState([])
  const [unmatched, setUnmatched] = useState([])
  
  // Фильтры
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyWithSuggestions, setShowOnlyWithSuggestions] = useState(false)

  useEffect(() => {
    loadIntegrations()
    loadLocalProducts()
  }, [])

  const loadIntegrations = async () => {
    try {
      const response = await api.get('/api/seller/api-keys')
      setIntegrations(response.data)
    } catch (error) {
      console.error('Failed to load integrations:', error)
    }
  }

  const loadLocalProducts = async () => {
    try {
      const response = await api.get('/api/catalog/products', {
        params: { limit: 1000 }
      })
      setLocalProducts(response.data)
    } catch (error) {
      console.error('Failed to load local products:', error)
    }
  }

  const loadMarketplaceProducts = async () => {
    if (!selectedMarketplace) {
      alert('Выберите маркетплейс')
      return
    }

    setLoading(true)
    try {
      const response = await api.get(`/api/marketplaces/${selectedMarketplace}/products`)
      const products = response.data
      
      console.log(`✅ Loaded ${products.length} products from ${selectedMarketplace}`)
      setMpProducts(products)
      
      // Сопоставляем
      matchProducts(products, localProducts)
      
    } catch (error) {
      alert('Ошибка загрузки товаров: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoading(false)
    }
  }

  const matchProducts = (mpProds, localProds) => {
    const matchedList = []
    const unmatchedList = []

    console.log(`🔍 Matching ${mpProds.length} MP products with ${localProds.length} local products`)
    console.log(`📌 Selected marketplace: ${selectedMarketplace}`)

    mpProds.forEach(mpProd => {
      // Проверяем есть ли уже связь в базе
      const linkedLocal = localProds.find(local => {
        // ИСПРАВЛЕНО: поле называется marketplace_specific_data в API response
        const mpData = local.marketplace_specific_data || local.marketplace_data || {}
        const mpInfo = mpData[selectedMarketplace]
        
        console.log(`  Checking ${local.article}: mpInfo =`, mpInfo)
        
        // Проверяем по ID товара на МП
        if (selectedMarketplace === 'ozon') {
          const matched = mpInfo?.id === mpProd.id || mpInfo?.offer_id === mpProd.sku
          if (matched) console.log(`    ✅ Matched Ozon: ${mpInfo.id} === ${mpProd.id}`)
          return matched
        } else if (selectedMarketplace === 'wb') {
          // ИСПРАВЛЕНО: проверяем все варианты полей для WB
          const matched = mpInfo?.nm_id === mpProd.id || mpInfo?.id === mpProd.id || mpInfo?.vendor_code === mpProd.sku
          if (matched) console.log(`    ✅ Matched WB: ${mpInfo.nm_id || mpInfo.id} === ${mpProd.id}`)
          return matched
        } else if (selectedMarketplace === 'yandex') {
          const matched = mpInfo?.offer_id === mpProd.sku
          if (matched) console.log(`    ✅ Matched Yandex: ${mpInfo.offer_id} === ${mpProd.sku}`)
          return matched
        }
        return false
      })

      if (linkedLocal) {
        console.log(`  ✅ Found link: ${mpProd.sku} ↔ ${linkedLocal.article}`)
        matchedList.push({
          mpProduct: mpProd,
          localProduct: linkedLocal,
          matchType: 'linked'
        })
      } else {
        // Ищем предложения по артикулу
        const suggestions = localProds.filter(local => 
          local.article.toLowerCase().includes(mpProd.sku.toLowerCase()) ||
          mpProd.sku.toLowerCase().includes(local.article.toLowerCase())
        )

        unmatchedList.push({
          mpProduct: mpProd,
          suggestions: suggestions.slice(0, 3), // Максимум 3 предложения
          matchType: 'unmatched'
        })
      }
    })

    setMatched(matchedList)
    setUnmatched(unmatchedList)
    
    console.log(`📊 Matched: ${matchedList.length}, Unmatched: ${unmatchedList.length}`)
  }

  const handleLink = async (mpProduct, localProduct) => {
    try {
      console.log('🔗 Linking:', mpProduct.sku, '→', localProduct.article)
      console.log('MP Product:', mpProduct)
      console.log('Local Product:', localProduct)
      
      const payload = {
        product: mpProduct,
        duplicate_action: 'link_only'
      }
      
      console.log('Sending payload:', payload)
      
      const response = await api.post('/api/products/import-from-marketplace', payload)
      
      console.log('Response:', response.data)
      
      if (response.data.status === 'duplicate_found') {
        alert('⚠️ Товар уже существует. Повторите попытку с выбором действия.')
        return
      }
      
      alert(`✅ Товары связаны!\n\n${mpProduct.name} (${selectedMarketplace.toUpperCase()}) ← → ${localProduct.name}`)
      
      // Перезагружаем и пересопоставляем
      const refreshResponse = await api.get('/api/catalog/products', {
        params: { limit: 1000 }
      })
      const refreshedLocalProds = refreshResponse.data
      setLocalProducts(refreshedLocalProds)
      matchProducts(mpProducts, refreshedLocalProds)
      
    } catch (error) {
      console.error('Link error:', error)
      console.error('Error response:', error.response?.data)
      alert('Ошибка связывания: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleUnlink = async (localProductId) => {
    if (!confirm('Удалить связь с маркетплейсом?')) return

    try {
      // Удаляем marketplace_data для этого МП
      const localProd = localProducts.find(p => p.id === localProductId)
      if (!localProd) {
        alert('Товар не найден')
        return
      }
      
      const mpData = { ...(localProd.marketplace_data || {}) }
      delete mpData[selectedMarketplace]

      await api.put(`/api/catalog/products/${localProductId}`, {
        marketplace_data: mpData
      })

      alert('✅ Связь удалена')
      
      // Перезагружаем и пересопоставляем
      const refreshResponse = await api.get('/api/catalog/products', {
        params: { limit: 1000 }
      })
      const refreshedLocalProds = refreshResponse.data
      setLocalProducts(refreshedLocalProds)
      matchProducts(mpProducts, refreshedLocalProds)

    } catch (error) {
      console.error('Unlink error:', error)
      alert('Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const getFilteredUnmatched = () => {
    let filtered = unmatched

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.mpProduct.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.mpProduct.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (showOnlyWithSuggestions) {
      filtered = filtered.filter(item => item.suggestions.length > 0)
    }

    return filtered
  }

  const mpIcon = {
    ozon: { icon: 'O', color: 'bg-blue-500', name: 'Ozon' },
    wb: { icon: 'WB', color: 'bg-purple-600', name: 'Wildberries' },
    yandex: { icon: 'Я', color: 'bg-red-500', name: 'Яндекс.Маркет' }
  }

  const currentMp = mpIcon[selectedMarketplace] || mpIcon.ozon

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-mm-cyan">СОПОСТАВЛЕНИЕ ТОВАРОВ</h1>
        <p className="text-sm text-mm-text-secondary mt-1">
          Связывание товаров из базы с товарами на маркетплейсах
        </p>
      </div>

      {/* Controls */}
      <div className="bg-mm-secondary p-4 rounded-lg space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-mm-text-secondary mb-2 uppercase">Маркетплейс</label>
            <select
              value={selectedMarketplace}
              onChange={(e) => setSelectedMarketplace(e.target.value)}
              className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
            >
              {integrations
                .filter(int => ['ozon', 'wb', 'yandex'].includes(int.marketplace))
                .map(int => (
                  <option key={int.id} value={int.marketplace}>
                    {int.marketplace.toUpperCase()} - {int.name || 'Интеграция'}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={loadMarketplaceProducts}
              disabled={loading}
              className="w-full px-4 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} />
              {loading ? 'Загрузка...' : 'Загрузить товары'}
            </button>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => matchProducts(mpProducts, localProducts)}
              disabled={mpProducts.length === 0}
              className="w-full px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FiLink />
              Автосопоставление
            </button>
          </div>
        </div>

        {/* Stats */}
        {mpProducts.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-mm-dark p-3 rounded">
              <p className="text-xs text-mm-text-secondary">Товаров на {currentMp.name}</p>
              <p className="text-2xl font-bold text-mm-cyan">{mpProducts.length}</p>
            </div>
            <div className="bg-mm-dark p-3 rounded">
              <p className="text-xs text-mm-text-secondary">Сопоставлено</p>
              <p className="text-2xl font-bold text-green-400">{matched.length}</p>
            </div>
            <div className="bg-mm-dark p-3 rounded">
              <p className="text-xs text-mm-text-secondary">Не сопоставлено</p>
              <p className="text-2xl font-bold text-orange-400">{unmatched.length}</p>
            </div>
          </div>
        )}
      </div>

      {mpProducts.length > 0 && (
        <>
          {/* Несопоставленные товары */}
          <div className="bg-mm-secondary rounded-lg overflow-hidden">
            <div className="bg-mm-dark p-4 border-b border-mm-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-orange-400 flex items-center gap-2">
                  <FiX className="text-orange-400" />
                  НЕСОПОСТАВЛЕННЫЕ ТОВАРЫ ({unmatched.length})
                </h2>
                
                {/* Фильтры */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-mm-text-secondary" />
                    <input
                      type="text"
                      placeholder="Поиск..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-mm-dark border border-mm-border rounded text-mm-text text-sm focus:border-mm-cyan outline-none w-64"
                    />
                  </div>
                  
                  <label className="flex items-center gap-2 text-sm text-mm-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOnlyWithSuggestions}
                      onChange={(e) => setShowOnlyWithSuggestions(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <FiFilter className="text-mm-cyan" />
                    Только с предложениями
                  </label>
                </div>
              </div>
            </div>

            <div className="divide-y divide-mm-border max-h-[500px] overflow-y-auto">
              {getFilteredUnmatched().map((item, index) => (
                <div key={index} className="p-4 hover:bg-mm-dark/50 transition">
                  <div className="grid grid-cols-12 gap-4 items-start">
                    {/* Товар с МП */}
                    <div className="col-span-5">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 ${currentMp.color} text-white rounded flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                          {currentMp.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-mm-text truncate">{item.mpProduct.name}</p>
                          <p className="text-xs text-mm-text-secondary font-mono">Артикул: {item.mpProduct.sku}</p>
                          {item.mpProduct.barcode && (
                            <p className="text-xs text-mm-text-secondary">Баркод: {item.mpProduct.barcode}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Стрелка */}
                    <div className="col-span-2 flex items-center justify-center">
                      <div className="text-2xl text-mm-text-secondary">→</div>
                    </div>

                    {/* Предложения */}
                    <div className="col-span-5">
                      {item.suggestions.length > 0 ? (
                        <div className="space-y-2">
                          {item.suggestions.map(suggestion => (
                            <div
                              key={suggestion.id}
                              className="flex items-center justify-between p-2 bg-mm-dark rounded border border-green-500/30"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-mm-text truncate">{suggestion.name}</p>
                                <p className="text-xs text-mm-text-secondary font-mono">Артикул: {suggestion.article}</p>
                              </div>
                              <button
                                onClick={() => handleLink(item.mpProduct, suggestion)}
                                className="ml-2 px-3 py-1 bg-green-600 text-white hover:bg-green-700 rounded text-xs font-medium flex items-center gap-1"
                              >
                                <FiLink size={12} />
                                Связать
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-mm-text-secondary italic">
                          Предложений не найдено
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {getFilteredUnmatched().length === 0 && (
                <div className="p-8 text-center text-mm-text-secondary">
                  {searchTerm || showOnlyWithSuggestions ? 'Нет результатов по фильтру' : 'Нет несопоставленных товаров'}
                </div>
              )}
            </div>
          </div>

          {/* Сопоставленные товары */}
          <div className="bg-mm-secondary rounded-lg overflow-hidden">
            <div className="bg-mm-dark p-4 border-b border-mm-border">
              <h2 className="text-lg font-bold text-green-400 flex items-center gap-2">
                <FiCheck className="text-green-400" />
                СОПОСТАВЛЕННЫЕ ТОВАРЫ ({matched.length})
              </h2>
            </div>

            <div className="divide-y divide-mm-border max-h-[400px] overflow-y-auto">
              {matched.map((item, index) => (
                <div key={index} className="p-4 hover:bg-mm-dark/50 transition">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    {/* Товар с МП */}
                    <div className="col-span-5">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 ${currentMp.color} text-white rounded flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                          {currentMp.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-mm-text truncate">{item.mpProduct.name}</p>
                          <p className="text-xs text-mm-text-secondary font-mono">Артикул: {item.mpProduct.sku}</p>
                        </div>
                      </div>
                    </div>

                    {/* Связь */}
                    <div className="col-span-2 flex items-center justify-center">
                      <div className="flex items-center gap-1 text-green-400">
                        <FiLink />
                        <span className="text-xs">связано</span>
                      </div>
                    </div>

                    {/* Товар из базы */}
                    <div className="col-span-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-mm-text truncate">{item.localProduct.name}</p>
                          <p className="text-xs text-mm-text-secondary font-mono">Артикул: {item.localProduct.article}</p>
                        </div>
                      </div>
                    </div>

                    {/* Действия */}
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => handleUnlink(item.localProduct.id)}
                        className="p-2 text-red-400 hover:bg-red-400/10 rounded transition"
                        title="Разорвать связь"
                      >
                        <FiX />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {matched.length === 0 && (
                <div className="p-8 text-center text-mm-text-secondary">
                  Нет сопоставленных товаров
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {mpProducts.length === 0 && (
        <div className="bg-mm-secondary p-12 rounded-lg text-center">
          <div className="text-6xl mb-4">🔗</div>
          <p className="text-mm-text-secondary text-lg">
            Выберите маркетплейс и нажмите "Загрузить товары"
          </p>
        </div>
      )}
    </div>
  )
}
