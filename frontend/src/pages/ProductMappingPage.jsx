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

  useEffect(() => {
    loadLocalProducts()
    loadCategories()
    loadIntegrations()
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
      setMpProducts(response.data || [])
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

  const importSelected = async () => {
    if (!importSettings.category_id) {
      alert('Выберите категорию')
      return
    }
    
    try {
      for (const mpId of selectedForImport) {
        await api.post(`/api/marketplaces/${marketplace}/import-product`, {
          marketplace_product_id: mpId
        })
      }
      
      alert(`Загружено ${selectedForImport.length} товаров!`)
      setShowImportModal(false)
      setSelectedForImport([])
      loadLocalProducts()
    } catch (error) {
      alert('Ошибка')
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

      <div className="flex space-x-3">
        <button onClick={() => setFilter('all')} className={`px-4 py-2 border-2 ${filter === 'all' ? 'border-mm-cyan text-mm-cyan' : 'border-mm-border text-mm-text-secondary'}`}>
          ВСЕ ({mpProducts.length})
        </button>
        <button onClick={() => setFilter('mapped')} className={`px-4 py-2 border-2 ${filter === 'mapped' ? 'border-mm-green text-mm-green' : 'border-mm-border text-mm-text-secondary'}`}>
          СОПОСТАВЛЕННЫЕ
        </button>
        <button onClick={() => setFilter('unmapped')} className={`px-4 py-2 border-2 ${filter === 'unmapped' ? 'border-mm-yellow text-mm-yellow' : 'border-mm-border text-mm-text-secondary'}`}>
          БЕЗ СВЯЗИ
        </button>
        <button onClick={() => setFilter('duplicates')} className={`px-4 py-2 border-2 ${filter === 'duplicates' ? 'border-mm-red text-mm-red' : 'border-mm-border text-mm-text-secondary'}`}>
          ДУБЛИКАТЫ
        </button>
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
                    <td className="py-4 px-4 font-mono text-sm text-mm-cyan">{mp.sku}</td>
                    <td className="py-4 px-4 text-sm">{mp.name}</td>
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
              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Категория *</label>
                <select value={importSettings.category_id} onChange={(e) => setImportSettings({...importSettings, category_id: e.target.value})} className="input-neon w-full">
                  <option value="">Выберите</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Тег</label>
                <input type="text" value={importSettings.tag} onChange={(e) => setImportSettings({...importSettings, tag: e.target.value})} className="input-neon w-full" />
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