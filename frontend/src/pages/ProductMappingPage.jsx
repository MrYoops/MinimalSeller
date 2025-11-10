import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiLink, FiDownload, FiFilter, FiCheckCircle } from 'react-icons/fi'

function ProductMappingPage() {
  const { api } = useAuth()
  const [marketplace, setMarketplace] = useState('ozon')
  const [mpProducts, setMpProducts] = useState([])
  const [localProducts, setLocalProducts] = useState([])
  const [mappings, setMappings] = useState({})
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedForImport, setSelectedForImport] = useState([])
  const [importSettings, setImportSettings] = useState({
    category_id: '',
    tag: ''
  })
  const [categories, setCategories] = useState([])

  useEffect(() => {
    loadLocalProducts()
    loadCategories()
  }, [])

  const loadLocalProducts = async () => {
    try {
      const response = await api.get('/api/products')
      setLocalProducts(response.data)
    } catch (error) {
      console.error('Failed to load local products:', error)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/admin/categories')
      setCategories(response.data)
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const loadMarketplaceProducts = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/api/marketplaces/${marketplace}/products`)
      setMpProducts(response.data || [])
    } catch (error) {
      alert('Ошибка загрузки товаров с маркетплейса')
    }
    setLoading(false)
  }

  const autoMatchBySKU = () => {
    const newMappings = {...mappings}
    let matchCount = 0
    
    mpProducts.forEach(mpProduct => {
      const localMatch = localProducts.find(lp => lp.sku === mpProduct.sku)
      if (localMatch) {
        newMappings[mpProduct.id] = localMatch.id
        matchCount++
      }
    })
    
    setMappings(newMappings)
    alert(`✅ Сопоставлено ${matchCount} товаров по артикулу!`)
  }

  const importSelected = async () => {
    if (selectedForImport.length === 0) {
      alert('Выберите товары для загрузки')
      return
    }
    
    if (!importSettings.category_id) {
      alert('Выберите категорию')
      return
    }
    
    try {
      for (const mpProductId of selectedForImport) {
        await api.post(`/api/marketplaces/${marketplace}/import-product`, {
          marketplace_product_id: mpProductId,
          category_id: importSettings.category_id,
          tag: importSettings.tag
        })
      }
      
      alert(`✅ Загружено ${selectedForImport.length} товаров!\\nТовары появятся во вкладке Products.`)
      setShowImportModal(false)
      setSelectedForImport([])
      loadLocalProducts()
      loadMarketplaceProducts()
    } catch (error) {
      alert('Ошибка импорта: ' + (error.response?.data?.detail || error.message))
    }
  }

  const getFilteredProducts = () => {
    if (filter === 'mapped') {
      return mpProducts.filter(mp => mappings[mp.id])
    } else if (filter === 'unmapped') {
      return mpProducts.filter(mp => !mappings[mp.id])
    } else if (filter === 'duplicates') {
      const skus = mpProducts.map(p => p.sku)
      const duplicates = skus.filter((sku, idx) => skus.indexOf(sku) !== idx)
      return mpProducts.filter(p => duplicates.includes(p.sku))
    }
    return mpProducts
  }

  const filteredProducts = getFilteredProducts()

  return (
    <div className=\"space-y-6\">
      <div className=\"flex items-center justify-between\">
        <div>
          <h2 className=\"text-2xl mb-2 text-mm-cyan uppercase\">СОПОСТАВЛЕНИЕ ТОВАРОВ</h2>
          <p className=\"comment\">// Связывание товаров из базы с товарами на маркетплейсе</p>
        </div>
        <div className=\"flex space-x-3\">
          <button
            onClick={autoMatchBySKU}
            disabled={mpProducts.length === 0}
            className=\"btn-secondary disabled:opacity-50\"
          >
            <FiLink className=\"inline mr-2\" />
            СОПОСТАВИТЬ ПО АРТИКУЛАМ
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            disabled={selectedForImport.length === 0}
            className=\"btn-primary disabled:opacity-50\"
          >
            <FiDownload className=\"inline mr-2\" />
            ЗАГРУЗИТЬ В БАЗУ ({selectedForImport.length})
          </button>
        </div>
      </div>

      {/* Marketplace Selector */}
      <div className=\"card-neon\">
        <div className=\"grid grid-cols-2 gap-4\">
          <div>
            <label className=\"block text-sm mb-2 text-mm-text-secondary uppercase\">Маркетплейс</label>
            <select
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
              className=\"input-neon w-full\"
            >
              <option value=\"ozon\">🔵 Ozon</option>
              <option value=\"wb\">🟣 Wildberries</option>
              <option value=\"yandex\">🟡 Яндекс.Маркет</option>
            </select>
          </div>
          <div className=\"flex items-end\">
            <button
              onClick={loadMarketplaceProducts}
              className=\"btn-primary w-full\"
            >
              ЗАГРУЗИТЬ ТОВАРЫ С {marketplace.toUpperCase()}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className=\"flex space-x-3\">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 border-2 font-mono text-sm transition-all ${
            filter === 'all' ? 'border-mm-cyan text-mm-cyan bg-mm-cyan/10' : 'border-mm-border text-mm-text-secondary'
          }`}
        >
          <FiFilter className=\"inline mr-2\" />
          ВСЕ ({mpProducts.length})
        </button>
        <button
          onClick={() => setFilter('mapped')}
          className={`px-4 py-2 border-2 font-mono text-sm transition-all ${
            filter === 'mapped' ? 'border-mm-green text-mm-green bg-mm-green/10' : 'border-mm-border text-mm-text-secondary'
          }`}
        >
          СОПОСТАВЛЕННЫЕ ({mpProducts.filter(mp => mappings[mp.id]).length})
        </button>
        <button
          onClick={() => setFilter('unmapped')}
          className={`px-4 py-2 border-2 font-mono text-sm transition-all ${
            filter === 'unmapped' ? 'border-mm-yellow text-mm-yellow bg-mm-yellow/10' : 'border-mm-border text-mm-text-secondary'
          }`}
        >
          БЕЗ СВЯЗИ ({mpProducts.filter(mp => !mappings[mp.id]).length})
        </button>
        <button
          onClick={() => setFilter('duplicates')}
          className={`px-4 py-2 border-2 font-mono text-sm transition-all ${
            filter === 'duplicates' ? 'border-mm-red text-mm-red bg-mm-red/10' : 'border-mm-border text-mm-text-secondary'
          }`}
        >
          ДУБЛИКАТЫ
        </button>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className=\"text-center py-12\">
          <p className=\"text-mm-cyan animate-pulse\">// LOADING...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className=\"card-neon text-center py-12\">
          <p className=\"text-mm-text-secondary mb-2\">Нет товаров</p>
          <p className=\"comment\">// Загрузите товары с маркетплейса</p>
        </div>
      ) : (
        <div className=\"card-neon overflow-hidden\">
          <table className=\"w-full\">
            <thead>
              <tr className=\"border-b border-mm-border\">
                <th className=\"py-4 px-4\">
                  <input
                    type=\"checkbox\"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedForImport(filteredProducts.map(p => p.id))
                      } else {
                        setSelectedForImport([])
                      }
                    }}
                    className=\"w-4 h-4\"
                  />
                </th>
                <th className=\"text-left py-4 px-4 text-mm-text-secondary uppercase text-sm\">Артикул (МП)</th>
                <th className=\"text-left py-4 px-4 text-mm-text-secondary uppercase text-sm\">Название (МП)</th>
                <th className=\"text-left py-4 px-4 text-mm-text-secondary uppercase text-sm\">Сопоставление</th>
                <th className=\"text-left py-4 px-4 text-mm-text-secondary uppercase text-sm\">Статус</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((mpProduct) => {
                const localProductId = mappings[mpProduct.id]
                const localProduct = localProducts.find(lp => lp.id === localProductId)
                
                return (
                  <tr key={mpProduct.id} className=\"border-b border-mm-border hover:bg-mm-gray\">
                    <td className=\"py-4 px-4\">
                      <input
                        type=\"checkbox\"
                        checked={selectedForImport.includes(mpProduct.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedForImport([...selectedForImport, mpProduct.id])
                          } else {
                            setSelectedForImport(selectedForImport.filter(id => id !== mpProduct.id))
                          }
                        }}
                        className=\"w-4 h-4\"
                      />
                    </td>
                    <td className=\"py-4 px-4 font-mono text-sm text-mm-cyan\">{mpProduct.sku}</td>
                    <td className=\"py-4 px-4 text-sm\">{mpProduct.name}</td>
                    <td className=\"py-4 px-4\">
                      {localProduct ? (
                        <span className=\"font-mono text-sm text-mm-green\">{localProduct.sku}</span>
                      ) : (
                        <select
                          value={mappings[mpProduct.id] || ''}
                          onChange={(e) => setMappings({...mappings, [mpProduct.id]: e.target.value})}
                          className=\"input-neon text-sm\"
                        >
                          <option value=\"\">Выбрать товар...</option>
                          {localProducts.map(lp => (
                            <option key={lp.id} value={lp.id}>{lp.sku} - {lp.minimalmod.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className=\"py-4 px-4\">
                      {localProduct ? (
                        <span className=\"flex items-center space-x-1 text-mm-green\">
                          <FiCheckCircle />
                          <span className=\"text-xs\">СВЯЗАН</span>
                        </span>
                      ) : (
                        <span className=\"text-xs text-mm-yellow\">НЕ СВЯЗАН</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className=\"fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50\">
          <div className=\"card-neon max-w-2xl w-full\">
            <div className=\"flex items-center justify-between mb-6\">
              <h3 className=\"text-xl text-mm-cyan\">ЗАГРУЗИТЬ ТОВАРЫ В БАЗУ</h3>
              <button onClick={() => setShowImportModal(false)} className=\"text-mm-text-secondary hover:text-mm-red\">✕</button>
            </div>

            <div className=\"space-y-6\">
              <div className=\"p-4 bg-mm-blue/5 border border-mm-blue\">
                <p className=\"text-mm-blue font-bold mb-2\">Выбрано товаров: {selectedForImport.length}</p>
                <p className=\"text-sm text-mm-text-secondary\">
                  Товары будут импортированы в вашу базу и автоматически сопоставлены по артикулу.
                </p>
              </div>

              <div>
                <label className=\"block text-sm mb-2 text-mm-text-secondary uppercase\">Категория *</label>
                <select
                  value={importSettings.category_id}
                  onChange={(e) => setImportSettings({...importSettings, category_id: e.target.value})}
                  className=\"input-neon w-full\"
                  required
                >
                  <option value=\"\">Выберите категорию</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className=\"block text-sm mb-2 text-mm-text-secondary uppercase\">Тег (опционально)</label>
                <input
                  type=\"text\"
                  value={importSettings.tag}
                  onChange={(e) => setImportSettings({...importSettings, tag: e.target.value})}
                  className=\"input-neon w-full\"
                  placeholder=\"например: новинка, акция\"
                />
              </div>

              <div className=\"flex space-x-4\">
                <button
                  onClick={importSelected}
                  disabled={!importSettings.category_id}
                  className=\"btn-primary flex-1 disabled:opacity-50\"
                >
                  ЗАГРУЗИТЬ
                </button>
                <button
                  onClick={() => setShowImportModal(false)}
                  className=\"btn-secondary flex-1\"
                >
                  ОТМЕНА
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductMappingPage
