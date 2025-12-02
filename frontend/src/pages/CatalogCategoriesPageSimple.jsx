import React, { useState, useEffect } from 'react'
import { FiArrowLeft, FiTrash2, FiEdit, FiRefreshCw, FiPackage } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import CatalogNavDropdown from '../components/CatalogNavDropdown'

export default function CatalogCategoriesPageSimple() {
  const { api } = useAuth()
  const [mappings, setMappings] = useState([])
  const [loading, setLoading] = useState(false)
  const [productCounts, setProductCounts] = useState({}) // Счетчик товаров для каждого маппинга

  useEffect(() => {
    loadMappings()
  }, [])

  const loadMappings = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/categories/mappings')
      const mappingsData = response.data || []
      setMappings(mappingsData)
      
      // Загрузить счетчики товаров для каждого маппинга
      await loadProductCounts(mappingsData)
    } catch (error) {
      console.error('Failed to load mappings:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const loadProductCounts = async (mappingsData) => {
    try {
      // Получить все товары
      const productsResponse = await api.get('/api/catalog/products?limit=1000')
      const products = productsResponse.data.products || []
      
      // Подсчитать товары для каждого маппинга
      const counts = {}
      mappingsData.forEach(mapping => {
        const count = products.filter(p => p.category_mapping_id === mapping.id).length
        counts[mapping.id] = count
      })
      
      setProductCounts(counts)
    } catch (error) {
      console.error('Failed to load product counts:', error)
    }
  }

  const deleteMapping = async (mappingId, mappingName) => {
    const productCount = productCounts[mappingId] || 0
    
    let confirmMessage = `Вы уверены что хотите удалить сопоставление "${mappingName}"?`
    if (productCount > 0) {
      confirmMessage += `\n\n⚠️ ВНИМАНИЕ: ${productCount} товаров используют эту категорию!\nУдаление сопоставления может повлиять на эти товары.`
    }
    confirmMessage += '\n\nЭто действие нельзя отменить.'
    
    if (!confirm(confirmMessage)) {
      return
    }
    
    try {
      await api.delete(`/api/categories/mappings/${mappingId}`)
      alert('✅ Сопоставление удалено!')
      loadMappings()
    } catch (error) {
      alert('❌ Ошибка удаления: ' + (error.response?.data?.detail || error.message))
    }
  }

  const getMappingStats = (mapping) => {
    const hasOzon = !!mapping.marketplace_categories?.ozon
    const hasWB = !!mapping.marketplace_categories?.wildberries
    const hasYandex = !!mapping.marketplace_categories?.yandex
    
    return { hasOzon, hasWB, hasYandex }
  }

  return (
    <div className="min-h-screen bg-mm-black text-mm-text p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="text-mm-cyan hover:underline mb-4 flex items-center gap-2"
        >
          <FiArrowLeft /> Назад к товарам
        </button>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <CatalogNavDropdown />
            <div>
              <h1 className="text-3xl font-bold text-mm-cyan mb-2">КАТЕГОРИИ</h1>
              <p className="text-gray-400 text-sm">
                Сопоставления категорий между маркетплейсами
              </p>
            </div>
          </div>
          
          <button
            onClick={loadMappings}
            disabled={loading}
            className="px-4 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} /> 
            Обновить
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-mm-secondary border border-mm-border rounded-lg p-4">
            <div className="text-2xl font-bold text-mm-cyan">{mappings.length}</div>
            <div className="text-sm text-gray-400">Всего сопоставлений</div>
          </div>
          
          <div className="bg-mm-secondary border border-mm-border rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">
              {mappings.filter(m => m.marketplace_categories?.wildberries).length}
            </div>
            <div className="text-sm text-gray-400">С Wildberries</div>
          </div>
          
          <div className="bg-mm-secondary border border-mm-border rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">
              {mappings.filter(m => m.marketplace_categories?.ozon).length}
            </div>
            <div className="text-sm text-gray-400">С Ozon</div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-cyan-900/20 border border-cyan-600/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div className="flex-1 text-sm text-cyan-200">
              <p className="font-semibold mb-1">Сопоставления создаются автоматически</p>
              <p className="text-cyan-300/80">
                При импорте товара или при выборе категории маркетплейса в редакторе товара система автоматически создаёт или обновляет сопоставление.
                На этой странице вы можете просмотреть все сопоставления и удалить ненужные.
              </p>
            </div>
          </div>
        </div>

        {/* Mappings Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-mm-cyan border-t-transparent"></div>
            <p className="mt-4 text-gray-400">Загрузка...</p>
          </div>
        ) : mappings.length === 0 ? (
          <div className="bg-mm-secondary border border-mm-border rounded-lg p-12 text-center">
            <FiPackage className="mx-auto text-6xl text-gray-600 mb-4" />
            <p className="text-gray-400 mb-2">Нет сопоставлений</p>
            <p className="text-sm text-gray-500">
              Импортируйте товар или создайте товар с выбором категории
            </p>
          </div>
        ) : (
          <div className="bg-mm-secondary border border-mm-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-mm-border bg-mm-dark">
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-xs font-semibold">
                    Название категории
                  </th>
                  <th className="text-center py-4 px-3 text-mm-text-secondary uppercase text-xs font-semibold">
                    🟠 Ozon
                  </th>
                  <th className="text-center py-4 px-3 text-mm-text-secondary uppercase text-xs font-semibold">
                    🟣 WB
                  </th>
                  <th className="text-center py-4 px-3 text-mm-text-secondary uppercase text-xs font-semibold">
                    🟡 Yandex
                  </th>
                  <th className="text-center py-4 px-3 text-mm-text-secondary uppercase text-xs font-semibold">
                    Товаров
                  </th>
                  <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-xs font-semibold">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => {
                  const { hasOzon, hasWB, hasYandex } = getMappingStats(mapping)
                  const productCount = productCounts[mapping.id] || 0
                  
                  return (
                    <tr key={mapping.id} className="border-b border-mm-border hover:bg-mm-gray transition">
                      <td className="py-4 px-4">
                        <div className="font-medium text-white">{mapping.internal_name}</div>
                        <div className="text-xs text-gray-500 mt-1">ID: {mapping.id}</div>
                      </td>
                      
                      <td className="py-4 px-3 text-center">
                        {hasOzon ? (
                          <div>
                            <span className="inline-block px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-xs border border-blue-600/30">
                              ✓
                            </span>
                            <div className="text-xs text-gray-500 mt-1">
                              {mapping.marketplace_categories.ozon}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      
                      <td className="py-4 px-3 text-center">
                        {hasWB ? (
                          <div>
                            <span className="inline-block px-2 py-1 bg-purple-600/20 text-purple-300 rounded text-xs border border-purple-600/30">
                              ✓
                            </span>
                            <div className="text-xs text-gray-500 mt-1">
                              {mapping.marketplace_categories.wildberries}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      
                      <td className="py-4 px-3 text-center">
                        {hasYandex ? (
                          <div>
                            <span className="inline-block px-2 py-1 bg-yellow-600/20 text-yellow-300 rounded text-xs border border-yellow-600/30">
                              ✓
                            </span>
                            <div className="text-xs text-gray-500 mt-1">
                              {mapping.marketplace_categories.yandex}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      
                      <td className="py-4 px-3 text-center">
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-600/20 text-cyan-300 rounded border border-cyan-600/30">
                          <FiPackage size={12} />
                          <span className="font-semibold">{productCount}</span>
                        </div>
                      </td>
                      
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => deleteMapping(mapping.id, mapping.internal_name)}
                          className="px-3 py-2 border border-red-500 text-red-500 hover:bg-red-500/10 rounded transition inline-flex items-center gap-2"
                          title="Удалить сопоставление"
                        >
                          <FiTrash2 size={14} />
                          Удалить
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
