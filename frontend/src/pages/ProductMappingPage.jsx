import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiLink, FiDownload, FiFilter, FiCheckCircle } from 'react-icons/fi'

function ProductMappingPage() {
  const { api } = useAuth()
  const [selectedIntegration, setSelectedIntegration] = useState('')
  const [integrations, setIntegrations] = useState([])
  const [mpProducts, setMpProducts] = useState([])
  const [localProducts, setLocalProducts] = useState([])
  const [mappings, setMappings] = useState({})
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedForImport, setSelectedForImport] = useState([])
  const [importSettings, setImportSettings] = useState({ category_id: '', tag: '' })
  const [categories, setCategories] = useState([])
  const [existingTags, setExistingTags] = useState([])

  useEffect(() => {
    loadLocalProducts()
    loadCategories()
    loadIntegrations()
    loadExistingTags()
  }, [])

  const loadIntegrations = async () => {
    try {
      const response = await api.get('/api/seller/api-keys')
      setIntegrations(response.data)
    } catch (error) {
      console.error('Failed:', error)
    }
  }

  const loadLocalProducts = async () => {
    try {
      const response = await api.get('/api/products')
      setLocalProducts(response.data)
    } catch (error) {
      console.error('Failed:', error)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/admin/categories')
      setCategories(response.data)
    } catch (error) {
      console.error('Failed:', error)
    }
  }

  const loadExistingTags = async () => {
    try {
      const response = await api.get('/api/products')
      const allTags = new Set()
      
      response.data.forEach(product => {
        const tags = product.tags || []
        tags.forEach(tag => allTags.add(tag))
      })
      
      setExistingTags(Array.from(allTags).sort())
    } catch (error) {
      console.error('Failed to load tags:', error)
    }
  }

  const loadMarketplaceProducts = async () => {
    if (!selectedIntegration) {
      alert('Выберите интеграцию!')
      return
    }
    
    const integration = integrations.find(i => i.id === selectedIntegration)
    if (!integration) return
    
    setLoading(true)
    try {
      const response = await api.get(`/api/marketplaces/${integration.marketplace}/products`)
      const mpProductsData = response.data || []
      setMpProducts(mpProductsData)
      
      // Автоматическое определение сопоставлений по артикулу
      const autoMappings = {}
      let autoMatched = 0
      
      mpProductsData.forEach(mp => {
        const local = localProducts.find(lp => lp.sku === mp.sku)
        if (local) {
          autoMappings[mp.id] = local.id
          autoMatched++
        }
      })
      
      setMappings(autoMappings)
      
      if (autoMatched > 0) {
        console.log(`✅ Автоматически сопоставлено ${autoMatched} товаров по артикулу`)
      }
      
    } catch (error) {
      alert('Ошибка загрузки товаров: ' + (error.response?.data?.detail || error.message))
    }
    setLoading(false)
  }

  const autoMatchBySKU = () => {
    const newMappings = {...mappings}
    let count = 0
    
    mpProducts.forEach(mp => {
      const local = localProducts.find(lp => lp.sku === mp.sku)
      if (local) {
        newMappings[mp.id] = local.id
        count++
      }
    })
    
    setMappings(newMappings)
    alert(`Сопоставлено ${count} товаров!`)
  }

  const saveMappings = async () => {
    try {
      const mappingsArray = Object.entries(mappings).map(([mpId, localId]) => ({
        marketplace_product_id: mpId,
        local_product_id: localId
      }))
      
      if (mappingsArray.length === 0) {
        alert('Нет сопоставлений для сохранения!')
        return
      }
      
      console.log('💾 Сохранение сопоставлений:', mappingsArray)
      
      // Save mappings to products (update marketplace_data)
      let saved = 0
      for (const mapping of mappingsArray) {
        const mpProduct = mpProducts.find(p => p.id === mapping.marketplace_product_id)
        const localProduct = localProducts.find(p => p.id === mapping.local_product_id)
        
        if (mpProduct && localProduct) {
          try {
            await api.put(`/api/products/${localProduct.id}/marketplace-mapping`, {
              marketplace: mpProduct.marketplace,
              marketplace_id: mpProduct.id,
              barcode: mpProduct.barcode || ''
            })
            saved++
          } catch (error) {
            console.error('Failed to save mapping:', error)
          }
        }
      }
      
      alert(`✅ Сохранено ${saved} сопоставлений!`)
      await loadLocalProducts()
      
    } catch (error) {
      alert('❌ Ошибка сохранения: ' + (error.response?.data?.detail || error.message))
    }
  }

  const importSelected = async () => {
    if (selectedForImport.length === 0) {
      alert('Выберите товары для импорта!')
      return
    }
    
    setShowImportModal(false)  // Закрываем модалку сразу
    
    try {
      let imported = 0
      let existing = 0
      
      for (const mpProductId of selectedForImport) {
        const mpProduct = mpProducts.find(p => p.id === mpProductId)
        if (!mpProduct) continue
        
        try {
          console.log('📦 Importing:', mpProduct.sku, mpProduct.name)
          
          const response = await api.post('/api/products/import-from-marketplace', {
            product: mpProduct,
            tag: importSettings.tag  // Отправляем тег
          })
          
          if (response.data.action === 'created') {
            imported++
          } else {
            existing++
          }
          
        } catch (error) {
          console.error('Failed:', mpProduct.sku, error)
        }
      }
      
      alert(`✅ Импорт завершён!\n\nНовых товаров: ${imported}\nУже существует: ${existing}\n\nТовары добавлены во вкладку PRODUCTS с автоматическим сопоставлением.`)
      setSelectedForImport([])
      
      // Reload data to show updated mappings
      await loadLocalProducts()
      await loadMarketplaceProducts()
      
    } catch (error) {
      console.error('❌ Import error:', error)
      alert('❌ Ошибка импорта: ' + (error.response?.data?.detail || error.message))
    }
  }


  const importSingleProduct = async (mpProduct) => {
    try {
      console.log('📦 Importing single product:', mpProduct.sku, mpProduct.name)
      
      const response = await api.post('/api/products/import-from-marketplace', {
        product: mpProduct
      })
      
      if (response.data.action === 'created') {
        alert(`✅ Товар импортирован!\n\n${mpProduct.name}\nSKU: ${mpProduct.sku}\n\nТовар добавлен во вкладку PRODUCTS.`)
      } else {
        alert(`ℹ️ Товар уже существует!\n\n${mpProduct.name}\nSKU: ${mpProduct.sku}`)
      }
      
      // Reload data
      await loadLocalProducts()
      await loadMarketplaceProducts()
      
    } catch (error) {
      console.error('❌ Import error:', error)
      alert('❌ Ошибка импорта: ' + (error.response?.data?.detail || error.message))
    }
  }

  const getFiltered = () => {
    if (filter === 'mapped') return mpProducts.filter(mp => mappings[mp.id])
    if (filter === 'unmapped') return mpProducts.filter(mp => !mappings[mp.id])
    if (filter === 'duplicates') {
      const skus = mpProducts.map(p => p.sku)
      const dups = skus.filter((s, i) => skus.indexOf(s) !== i)
      return mpProducts.filter(p => dups.includes(p.sku))
    }
    return mpProducts
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl mb-2 text-mm-cyan uppercase">СОПОСТАВЛЕНИЕ ТОВАРОВ</h2>
          <p className="comment">// Связывание товаров</p>
        </div>
        <div className="flex space-x-3">
          <button onClick={autoMatchBySKU} disabled={mpProducts.length === 0} className="btn-secondary disabled:opacity-50">
            <FiLink className="inline mr-2" />СОПОСТАВИТЬ ПО АРТИКУЛАМ
          </button>
          <button onClick={() => setShowImportModal(true)} disabled={selectedForImport.length === 0} className="btn-primary disabled:opacity-50">
            <FiDownload className="inline mr-2" />ЗАГРУЗИТЬ ({selectedForImport.length})
          </button>
        </div>
      </div>

      <div className="card-neon">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Выберите интеграцию</label>
            <select 
              value={selectedIntegration} 
              onChange={(e) => setSelectedIntegration(e.target.value)} 
              className="input-neon w-full"
            >
              <option value="">Выберите интеграцию...</option>
              {integrations.map(int => {
                const mpName = int.marketplace.toUpperCase()
                const displayName = int.name || `${mpName} - ${int.client_id?.substring(0, 8) || 'Интеграция'}`
                return (
                  <option key={int.id} value={int.id}>
                    {displayName}
                  </option>
                )
              })}
            </select>
            <p className="comment text-xs mt-1">// Настраиваются во вкладке API KEYS</p>
          </div>
          <div className="flex items-end">
            <button 
              onClick={loadMarketplaceProducts} 
              disabled={!selectedIntegration}
              className="btn-primary w-full disabled:opacity-50"
            >
              ЗАГРУЗИТЬ ТОВАРЫ С МП
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex space-x-3">
          <button onClick={() => setFilter('all')} className={`px-4 py-2 border-2 ${filter === 'all' ? 'border-mm-cyan text-mm-cyan' : 'border-mm-border text-mm-text-secondary'}`}>
            ВСЕ ({mpProducts.length})
          </button>
          <button onClick={() => setFilter('mapped')} className={`px-4 py-2 border-2 ${filter === 'mapped' ? 'border-mm-green text-mm-green' : 'border-mm-border text-mm-text-secondary'}`}>
            СОПОСТАВЛЕННЫЕ ({getFiltered().filter(mp => mappings[mp.id]).length})
          </button>
          <button onClick={() => setFilter('unmapped')} className={`px-4 py-2 border-2 ${filter === 'unmapped' ? 'border-mm-yellow text-mm-yellow' : 'border-mm-border text-mm-text-secondary'}`}>
            БЕЗ СВЯЗИ ({getFiltered().filter(mp => !mappings[mp.id]).length})
          </button>
          <button onClick={() => setFilter('duplicates')} className={`px-4 py-2 border-2 ${filter === 'duplicates' ? 'border-mm-red text-mm-red' : 'border-mm-border text-mm-text-secondary'}`}>
            ДУБЛИКАТЫ
          </button>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={saveMappings}
            disabled={Object.keys(mappings).length === 0}
            className="btn-secondary disabled:opacity-50"
          >
            💾 СОХРАНИТЬ СОПОСТАВЛЕНИЯ
          </button>
          <button
            onClick={importSelected}
            disabled={selectedForImport.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            📥 ИМПОРТ В БАЗУ ({selectedForImport.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><p className="text-mm-cyan animate-pulse">// LOADING...</p></div>
      ) : getFiltered().length === 0 ? (
        <div className="card-neon text-center py-12">
          <p className="text-mm-text-secondary">Нет товаров</p>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-mm-border">
                <th className="py-4 px-4"><input type="checkbox" className="w-4 h-4" /></th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Фото</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Артикул</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Название</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Сопоставление</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Статус</th>
              </tr>
            </thead>
            <tbody>
              {getFiltered().map((mp) => {
                const local = localProducts.find(lp => lp.id === mappings[mp.id])
                return (
                  <tr key={mp.id} className="border-b border-mm-border hover:bg-mm-gray">
                    <td className="py-4 px-4">
                      <input
                        type="checkbox"
                        checked={selectedForImport.includes(mp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedForImport([...selectedForImport, mp.id])
                          } else {
                            setSelectedForImport(selectedForImport.filter(id => id !== mp.id))
                          }
                        }}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="py-4 px-4">
                      {mp.photos && mp.photos[0] ? (
                        <img 
                          src={mp.photos[0]} 
                          alt={mp.name}
                          className="w-16 h-16 object-cover border border-mm-border"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      ) : (
                        <div className="w-16 h-16 bg-mm-darker border border-mm-border flex items-center justify-center text-mm-text-tertiary text-xs">
                          NO IMG
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-mono text-sm text-mm-cyan">{mp.sku}</div>
                      {mp.barcode && <div className="text-xs text-mm-text-secondary mt-1">Баркод: {mp.barcode}</div>}
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm font-semibold">{mp.name}</div>
                      {mp.description && (
                        <div className="text-xs text-mm-text-secondary mt-1 line-clamp-2">
                          {mp.description.substring(0, 100)}...
                        </div>
                      )}
                      {mp.characteristics && mp.characteristics.length > 0 && (
                        <div className="text-xs text-mm-text-tertiary mt-1">
                          {mp.characteristics.length} характеристик
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {local ? (
                        <span className="font-mono text-sm text-mm-green">{local.sku}</span>
                      ) : (
                        <select
                          value={mappings[mp.id] || ''}
                          onChange={(e) => setMappings({...mappings, [mp.id]: e.target.value})}
                          className="input-neon text-sm"
                        >
                          <option value="">Выбрать...</option>
                          {localProducts.map(lp => (
                            <option key={lp.id} value={lp.id}>{lp.sku}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {local ? (
                        <span className="flex items-center space-x-1 text-mm-green text-xs">
                          <FiCheckCircle />СВЯЗАН
                        </span>
                      ) : (
                        <span className="text-xs text-mm-yellow">НЕ СВЯЗАН</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          <div className="card-neon max-w-md w-full">
            <h3 className="text-xl text-mm-cyan mb-6">ЗАГРУЗИТЬ В БАЗУ</h3>
            <div className="space-y-4">
              <div className="p-4 bg-mm-blue/5 border border-mm-blue">
                <p className="text-mm-blue font-bold mb-2">Выбрано товаров: {selectedForImport.length}</p>
                <p className="text-sm text-mm-text-secondary">
                  • Категория определится автоматически<br/>
                  • Артикул продавца сохранится<br/>
                  • Описание и фото импортируются<br/>
                  • Характеристики перенесутся
                </p>
              </div>

              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Тег (опционально)</label>
                <input 
                  type="text" 
                  value={importSettings.tag} 
                  onChange={(e) => setImportSettings({...importSettings, tag: e.target.value})} 
                  className="input-neon w-full"
                  placeholder="например: новинка, акция"
                  list="existing-tags"
                />
                <datalist id="existing-tags">
                  {existingTags.map(tag => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
                {existingTags.length > 0 && (
                  <div className="mt-2">
                    <p className="comment text-xs mb-1">// Существующие теги:</p>
                    <div className="flex flex-wrap gap-2">
                      {existingTags.slice(0, 10).map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setImportSettings({...importSettings, tag: tag})}
                          className="px-2 py-1 text-xs border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 transition-colors"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex space-x-4">
                <button onClick={importSelected} className="btn-primary flex-1">ЗАГРУЗИТЬ</button>
                <button onClick={() => setShowImportModal(false)} className="btn-secondary flex-1">ОТМЕНА</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductMappingPage