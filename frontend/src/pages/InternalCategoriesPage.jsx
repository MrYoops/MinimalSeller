import React, { useState, useEffect } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiSave, FiAlertCircle, FiCheck } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

export default function InternalCategoriesPage() {
  const { api } = useAuth()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Form state
  const [formData, setFormData] = useState({
    internal_name: '',
    slug: '',
    site_visibility: true,
    default_channels: ['site'],
    ozon_category_id: '',
    ozon_type_id: '',
    wb_category_id: '',
    yandex_category_id: '',
    internal_attributes: []
  })
  
  // Marketplace category search
  const [mpSearch, setMpSearch] = useState({
    ozon: '',
    wb: '',
    yandex: ''
  })
  const [mpResults, setMpResults] = useState({
    ozon: [],
    wb: [],
    yandex: []
  })
  const [mpLoading, setMpLoading] = useState({})

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/internal-categories?limit=100')
      setCategories(response.data.categories || [])
    } catch (error) {
      console.error('Failed to load categories:', error)
      alert('Ошибка загрузки категорий')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingId(null)
    setFormData({
      internal_name: '',
      slug: '',
      site_visibility: true,
      default_channels: ['site'],
      ozon_category_id: '',
      ozon_type_id: '',
      wb_category_id: '',
      yandex_category_id: '',
      internal_attributes: []
    })
    setMpSearch({ ozon: '', wb: '', yandex: '' })
    setMpResults({ ozon: [], wb: [], yandex: [] })
    setShowForm(true)
  }

  const handleEdit = (category) => {
    setEditingId(category.id)
    setFormData({
      internal_name: category.internal_name,
      slug: category.slug || '',
      site_visibility: category.site_visibility ?? true,
      default_channels: category.default_channels || ['site'],
      ozon_category_id: category.marketplace_mappings?.ozon?.category_id || '',
      ozon_type_id: category.marketplace_mappings?.ozon?.type_id || '',
      wb_category_id: category.marketplace_mappings?.wb?.category_id || '',
      yandex_category_id: category.marketplace_mappings?.yandex?.category_id || '',
      internal_attributes: category.internal_attributes || []
    })
    setMpSearch({ ozon: '', wb: '', yandex: '' })
    setMpResults({ ozon: [], wb: [], yandex: [] })
    setShowForm(true)
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Удалить категорию "${name}"?`)) return
    
    try {
      await api.delete(`/api/internal-categories/${id}`)
      alert('✅ Категория удалена')
      loadCategories()
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleSave = async () => {
    if (!formData.internal_name) {
      alert('Введите название категории')
      return
    }

    try {
      if (editingId) {
        await api.put(`/api/internal-categories/${editingId}`, formData)
        alert('✅ Категория обновлена')
      } else {
        await api.post('/api/internal-categories', formData)
        alert('✅ Категория создана')
      }
      
      setShowForm(false)
      loadCategories()
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  // Search marketplace categories
  const searchMarketplaceCategory = async (marketplace) => {
    const query = mpSearch[marketplace]
    if (!query || query.length < 2) return

    setMpLoading(prev => ({ ...prev, [marketplace]: true }))

    try {
      const response = await api.get(`/api/categories/marketplace/${marketplace}/search?query=${encodeURIComponent(query)}`)
      setMpResults(prev => ({
        ...prev,
        [marketplace]: response.data.categories || []
      }))
    } catch (error) {
      console.error(`Failed to search ${marketplace}:`, error)
      alert(`Ошибка поиска ${marketplace}: ${error.response?.data?.detail || error.message}`)
    } finally {
      setMpLoading(prev => ({ ...prev, [marketplace]: false }))
    }
  }

  const selectMarketplaceCategory = (marketplace, category) => {
    if (marketplace === 'ozon') {
      setFormData(prev => ({
        ...prev,
        ozon_category_id: category.category_id || category.id,
        ozon_type_id: category.type_id || ''
      }))
    } else if (marketplace === 'wb') {
      setFormData(prev => ({
        ...prev,
        wb_category_id: category.category_id || category.id
      }))
    } else if (marketplace === 'yandex') {
      setFormData(prev => ({
        ...prev,
        yandex_category_id: category.category_id || category.id
      }))
    }
    
    // Clear search
    setMpResults(prev => ({ ...prev, [marketplace]: [] }))
    setMpSearch(prev => ({ ...prev, [marketplace]: '' }))
  }

  const filteredCategories = categories.filter(cat => 
    cat.internal_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const mpColors = {
    ozon: { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-500' },
    wb: { bg: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-500' },
    yandex: { bg: 'bg-yellow-500', text: 'text-yellow-600', border: 'border-yellow-500' }
  }

  const mpNames = {
    ozon: 'Ozon',
    wb: 'Wildberries',
    yandex: 'Яндекс'
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#E5E7EB] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-[#06B6D4] mb-2">Внутренние Категории</h1>
            <p className="text-[#A7AFB8]">
              Управление категориями для собственного сайта и сопоставление с маркетплейсами
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="px-6 py-3 bg-[#06B6D4] text-[#0B1220] rounded-lg font-bold hover:bg-cyan-400 transition-colors flex items-center gap-2"
            data-testid="create-category-button"
          >
            <FiPlus /> Создать категорию
          </button>
        </div>

        {/* Search */}
        <div className="mb-6 relative">
          <FiSearch className="absolute left-4 top-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск категорий..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#111827] border border-[#334155] rounded-lg text-white placeholder-gray-500 focus:border-[#22D3EE] focus:ring-2 focus:ring-[#22D3EE]/50 outline-none"
            data-testid="category-search-input"
          />
        </div>

        {/* Categories List */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Загрузка...</div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">Категорий пока нет</p>
            <button
              onClick={handleCreate}
              className="px-6 py-2 bg-[#06B6D4] text-[#0B1220] rounded-lg hover:bg-cyan-400"
            >
              Создать первую категорию
            </button>
          </div>
        ) : (
          <div className="bg-[#111827] border border-[#334155] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#0F172A] border-b border-[#334155]">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#A7AFB8]">Название</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#A7AFB8]">Slug</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#A7AFB8]">Маркетплейсы</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-[#A7AFB8]">Атрибуты</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-[#A7AFB8]">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((category) => (
                  <tr 
                    key={category.id} 
                    className="border-b border-[#334155] hover:bg-slate-800/60 transition-colors"
                    data-testid={`category-row-${category.id}`}
                  >
                    <td className="px-6 py-4 font-medium">{category.internal_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{category.slug || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {category.marketplace_mappings?.ozon?.category_id && (
                          <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded">
                            Ozon
                          </span>
                        )}
                        {category.marketplace_mappings?.wb?.category_id && (
                          <span className="px-2 py-1 bg-purple-500 text-white text-xs rounded">
                            WB
                          </span>
                        )}
                        {category.marketplace_mappings?.yandex?.category_id && (
                          <span className="px-2 py-1 bg-yellow-500 text-black text-xs rounded">
                            Яндекс
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {category.internal_attributes?.length || 0}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(category)}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                          data-testid={`edit-category-${category.id}`}
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          onClick={() => handleDelete(category.id, category.internal_name)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                          data-testid={`delete-category-${category.id}`}
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-6 overflow-y-auto">
            <div className="bg-[#111827] border border-[#334155] rounded-xl w-full max-w-4xl my-8">
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#334155] flex justify-between items-center">
                <h2 className="text-2xl font-bold text-[#06B6D4]">
                  {editingId ? 'Редактировать категорию' : 'Создать категорию'}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <FiX size={24} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#A7AFB8] mb-2">
                      Название <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.internal_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, internal_name: e.target.value }))}
                      className="w-full px-4 py-2 bg-[#1F2937] border border-[#334155] rounded-lg text-white focus:border-[#22D3EE] focus:ring-2 focus:ring-[#22D3EE]/50 outline-none"
                      placeholder="Например: Компьютерные мыши"
                      data-testid="category-name-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#A7AFB8] mb-2">
                      Slug
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                      className="w-full px-4 py-2 bg-[#1F2937] border border-[#334155] rounded-lg text-white focus:border-[#22D3EE] focus:ring-2 focus:ring-[#22D3EE]/50 outline-none"
                      placeholder="computer-mice"
                    />
                  </div>
                </div>

                {/* Marketplace Mappings */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-4">Сопоставление с маркетплейсами</h3>
                  <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 mb-4">
                    <p className="text-yellow-200 text-sm flex items-start gap-2">
                      <FiAlertCircle className="mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>Важно:</strong> Используйте поиск чтобы найти правильную категорию на маркетплейсе. 
                        Неправильное сопоставление приведет к загрузке неверных характеристик.
                      </span>
                    </p>
                  </div>

                  {/* Ozon */}
                  <div className="mb-4 p-4 bg-[#1F2937] border-l-4 border-blue-500 rounded">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="font-bold text-blue-400">Ozon</h4>
                      {formData.ozon_category_id && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded flex items-center gap-1">
                          <FiCheck size={12} /> Выбрано: {formData.ozon_category_id}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={mpSearch.ozon}
                        onChange={(e) => setMpSearch(prev => ({ ...prev, ozon: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && searchMarketplaceCategory('ozon')}
                        placeholder="Поиск категории Ozon (минимум 2 символа)..."
                        className="w-full px-4 py-2 pr-24 bg-[#0F172A] border border-[#334155] rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 outline-none"
                      />
                      <button
                        onClick={() => searchMarketplaceCategory('ozon')}
                        disabled={mpLoading.ozon || mpSearch.ozon.length < 2}
                        className="absolute right-2 top-1.5 px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {mpLoading.ozon ? 'Поиск...' : 'Искать'}
                      </button>
                    </div>
                    
                    {mpResults.ozon.length > 0 && (
                      <div className="mt-2 max-h-48 overflow-y-auto bg-[#0F172A] border border-[#334155] rounded">
                        {mpResults.ozon.map((cat, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectMarketplaceCategory('ozon', cat)}
                            className="w-full px-4 py-2 text-left hover:bg-blue-500/20 border-b border-[#334155] last:border-b-0 transition-colors"
                          >
                            <div className="font-medium text-white">{cat.category_name || cat.name}</div>
                            <div className="text-xs text-gray-400">
                              ID: {cat.category_id || cat.id} 
                              {cat.type_id && ` | Type: ${cat.type_id}`}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Wildberries */}
                  <div className="mb-4 p-4 bg-[#1F2937] border-l-4 border-purple-500 rounded">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="font-bold text-purple-400">Wildberries</h4>
                      {formData.wb_category_id && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded flex items-center gap-1">
                          <FiCheck size={12} /> Выбрано: {formData.wb_category_id}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={mpSearch.wb}
                        onChange={(e) => setMpSearch(prev => ({ ...prev, wb: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && searchMarketplaceCategory('wb')}
                        placeholder="Поиск категории Wildberries (минимум 2 символа)..."
                        className="w-full px-4 py-2 pr-24 bg-[#0F172A] border border-[#334155] rounded-lg text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 outline-none"
                      />
                      <button
                        onClick={() => searchMarketplaceCategory('wb')}
                        disabled={mpLoading.wb || mpSearch.wb.length < 2}
                        className="absolute right-2 top-1.5 px-3 py-1.5 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {mpLoading.wb ? 'Поиск...' : 'Искать'}
                      </button>
                    </div>
                    
                    {mpResults.wb.length > 0 && (
                      <div className="mt-2 max-h-48 overflow-y-auto bg-[#0F172A] border border-[#334155] rounded">
                        {mpResults.wb.map((cat, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectMarketplaceCategory('wb', cat)}
                            className="w-full px-4 py-2 text-left hover:bg-purple-500/20 border-b border-[#334155] last:border-b-0 transition-colors"
                          >
                            <div className="font-medium text-white">{cat.category_name || cat.name}</div>
                            <div className="text-xs text-gray-400">ID: {cat.category_id || cat.id}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Yandex */}
                  <div className="p-4 bg-[#1F2937] border-l-4 border-yellow-500 rounded">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="font-bold text-yellow-400">Яндекс Маркет</h4>
                      {formData.yandex_category_id && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded flex items-center gap-1">
                          <FiCheck size={12} /> Выбрано: {formData.yandex_category_id}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={mpSearch.yandex}
                        onChange={(e) => setMpSearch(prev => ({ ...prev, yandex: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && searchMarketplaceCategory('yandex')}
                        placeholder="Поиск категории Яндекс Маркет (минимум 2 символа)..."
                        className="w-full px-4 py-2 pr-24 bg-[#0F172A] border border-[#334155] rounded-lg text-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/50 outline-none"
                      />
                      <button
                        onClick={() => searchMarketplaceCategory('yandex')}
                        disabled={mpLoading.yandex || mpSearch.yandex.length < 2}
                        className="absolute right-2 top-1.5 px-3 py-1.5 bg-yellow-500 text-black rounded text-sm hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {mpLoading.yandex ? 'Поиск...' : 'Искать'}
                      </button>
                    </div>
                    
                    {mpResults.yandex.length > 0 && (
                      <div className="mt-2 max-h-48 overflow-y-auto bg-[#0F172A] border border-[#334155] rounded">
                        {mpResults.yandex.map((cat, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectMarketplaceCategory('yandex', cat)}
                            className="w-full px-4 py-2 text-left hover:bg-yellow-500/20 border-b border-[#334155] last:border-b-0 transition-colors"
                          >
                            <div className="font-medium text-white">{cat.category_name || cat.name}</div>
                            <div className="text-xs text-gray-400">ID: {cat.category_id || cat.id}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-[#334155] flex justify-end gap-3">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 bg-[#374151] text-white rounded-lg hover:bg-[#4B5563] transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-[#06B6D4] text-[#0B1220] rounded-lg font-bold hover:bg-cyan-400 transition-colors flex items-center gap-2"
                  data-testid="save-category-button"
                >
                  <FiSave /> Сохранить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
