import React, { useState, useEffect } from 'react'
import { FiPlus, FiSearch, FiFilter, FiDownload, FiUpload, FiEdit, FiTrash2, FiPackage, FiLink, FiDollarSign } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import SyncLogsTab from './SyncLogsTab'

export default function CatalogProductsPage() {
  const { api } = useAuth()
  const [activeTab, setActiveTab] = useState('products') // products | sync
  const [products, setProducts] = useState([])
  const [productsWithPhotos, setProductsWithPhotos] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('created_at')
  const [ascending, setAscending] = useState(false)

  useEffect(() => {
    loadCategories()
    loadProducts()
  }, [searchTerm, selectedCategory, selectedBrand, selectedStatus, page, sortBy, ascending])

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/catalog/categories')
      setCategories(response.data)
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const loadProducts = async () => {
    try {
      setLoading(true)
      const params = {
        page,
        limit: 50,
        sort_by: sortBy,
        ascending
      }
      if (searchTerm) params.search = searchTerm
      if (selectedCategory) params.category_id = selectedCategory
      if (selectedBrand) params.brand = selectedBrand
      if (selectedStatus) params.status = selectedStatus

      const response = await api.get('/api/catalog/products', { params })
      const productsData = response.data
      setProducts(productsData)
      
      // Загрузить первое фото для каждого товара
      const productsWithPhotosData = await Promise.all(
        productsData.map(async (product) => {
          try {
            const photosResponse = await api.get(`/api/catalog/products/${product.id}/photos`)
            const photos = photosResponse.data
            return {
              ...product,
              firstPhoto: photos.length > 0 ? photos[0].url : null
            }
          } catch (error) {
            console.error(`Failed to load photos for product ${product.id}:`, error)
            return { ...product, firstPhoto: null }
          }
        })
      )
      
      setProductsWithPhotos(productsWithPhotosData)
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (productId) => {
    if (!window.confirm('Вы уверены, что хотите НАВСЕГДА удалить этот товар? Это действие нельзя отменить.')) return
    
    try {
      await api.delete(`/api/catalog/products/${productId}`)
      loadProducts()
    } catch (error) {
      alert('Ошибка при удалении товара: ' + error.message)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      active: <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-400">Активен</span>,
      draft: <span className="px-2 py-1 text-xs rounded bg-yellow-500/20 text-yellow-400">Черновик</span>,
      archived: <span className="px-2 py-1 text-xs rounded bg-gray-500/20 text-gray-400">Архив</span>
    }
    return badges[status] || badges.draft
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-mm-cyan">ТОВАРЫ</h1>
          <p className="text-sm text-mm-text-secondary mt-1">Каталог товаров</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.href = '/catalog/products/new'}
            className="px-4 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded flex items-center gap-2"
          >
            <FiPlus /> СОЗДАТЬ ТОВАР
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-mm-secondary p-4 rounded-lg space-y-4">
        {/* Search */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-mm-text-secondary" />
            <input
              type="text"
              placeholder="Поиск по артикулу, названию, штрих-коду..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              showFilters ? 'bg-mm-cyan text-mm-dark' : 'bg-mm-dark text-mm-text hover:bg-mm-dark/80'
            }`}
          >
            <FiFilter /> ФИЛЬТРЫ
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-mm-text-secondary mb-1">Категория</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
              >
                <option value="">Все категории</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-mm-text-secondary mb-1">Бренд</label>
              <input
                type="text"
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                placeholder="Фильтр по бренду"
                className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-mm-text-secondary mb-1">Статус</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
              >
                <option value="">Все статусы</option>
                <option value="active">Активен</option>
                <option value="draft">Черновик</option>
                <option value="archived">Архив</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-mm-text-secondary mb-1">Сортировка</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
              >
                <option value="created_at">По дате создания</option>
                <option value="name">По названию</option>
                <option value="article">По артикулу</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-mm-cyan"></div>
          <p className="text-mm-text-secondary mt-4">Загрузка товаров...</p>
        </div>
      ) : productsWithPhotos.length === 0 ? (
        <div className="text-center py-12 bg-mm-secondary rounded-lg">
          <FiPackage className="mx-auto text-6xl text-mm-text-secondary mb-4" />
          <p className="text-mm-text-secondary text-lg">Нет товаров</p>
          <p className="text-mm-text-secondary text-sm mt-2">Создайте первый товар или импортируйте товары</p>
          <button
            onClick={() => window.location.href = '/catalog/products/new'}
            className="mt-4 px-6 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded"
          >
            Создать товар
          </button>
        </div>
      ) : (
        <div className="bg-mm-secondary rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-mm-dark border-b border-mm-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Фото</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Артикул</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Название</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">МП</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Цена</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Бренд</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Категория</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Вариаций</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mm-border">
              {productsWithPhotos.map((product) => (
                <tr key={product.id} className="hover:bg-mm-dark/50 transition">
                  <td className="px-4 py-3">
                    {product.firstPhoto ? (
                      <img
                        src={product.firstPhoto}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded bg-mm-dark"
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextSibling.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    <div 
                      className="w-12 h-12 bg-mm-dark rounded flex items-center justify-center"
                      style={{ display: product.firstPhoto ? 'none' : 'flex' }}
                    >
                      <FiPackage className="text-mm-text-secondary" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-mm-text font-mono">{product.article}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-mm-text">{product.name}</div>
                    {product.description && (
                      <div className="text-xs text-mm-text-secondary mt-1 truncate max-w-xs">
                        {product.description}
                      </div>
                    )}
                  </td>
                  {/* Колонка маркетплейсов */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {(() => {
                        // ИСПРАВЛЕНО: поле может называться marketplace_data или marketplace_specific_data
                        const mpData = product.marketplace_specific_data || product.marketplace_data || {}
                        const marketplaces = []
                        
                        // Проверяем Ozon
                        if (mpData.ozon?.product_id || mpData.ozon?.offer_id || mpData.ozon?.id) {
                          marketplaces.push(
                            <div key="ozon" className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold" title="Ozon (создано)">O</div>
                          )
                        }
                        
                        // Проверяем Wildberries (проверяем все варианты полей)
                        if (mpData.wb?.nm_id || mpData.wb?.id || mpData.wb?.vendor_code) {
                          marketplaces.push(
                            <div key="wb" className="w-6 h-6 bg-purple-600 text-white rounded flex items-center justify-center text-[9px] font-bold" title="Wildberries (создано)">WB</div>
                          )
                        }
                        
                        // Проверяем Yandex
                        if (mpData.yandex?.offer_id || mpData.yandex?.shop_sku) {
                          marketplaces.push(
                            <div key="yandex" className="w-6 h-6 bg-red-500 text-white rounded flex items-center justify-center text-[10px] font-bold" title="Яндекс.Маркет (создано)">Я</div>
                          )
                        }
                        
                        return marketplaces.length > 0 ? marketplaces : <span className="text-xs text-mm-text-secondary">—</span>
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {product.price_discounted ? (
                      <div className="flex flex-col">
                        <span className="text-mm-cyan font-bold text-base">
                          {(product.price_discounted / 100).toFixed(2)} ₽
                        </span>
                        <span className="text-mm-text-secondary text-xs line-through">
                          {(product.price / 100).toFixed(2)} ₽
                        </span>
                      </div>
                    ) : product.price > 0 ? (
                      <span className="text-mm-text text-sm">
                        {(product.price / 100).toFixed(2)} ₽
                      </span>
                    ) : (
                      <span className="text-mm-text-secondary text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-mm-text">{product.brand || '-'}</td>
                  <td className="px-4 py-3 text-sm text-mm-text">{product.category_name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-mm-text">
                    <div className="flex items-center gap-2">
                      <span className="text-mm-cyan">{product.variants_count}</span>
                      {product.is_grouped && (
                        <span className="text-xs text-mm-text-secondary">(групп.)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(product.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => window.location.href = `/catalog/products/${product.id}/edit`}
                        className="p-2 text-mm-cyan hover:bg-mm-cyan/10 rounded transition"
                        title="Редактировать"
                      >
                        <FiEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 text-red-400 hover:bg-red-400/10 rounded transition"
                        title="Удалить навсегда"
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

      {/* Pagination */}
      {productsWithPhotos.length > 0 && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-mm-text-secondary">
            Показано товаров: {productsWithPhotos.length}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-mm-secondary text-mm-text hover:bg-mm-secondary/80 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Назад
            </button>
            <span className="px-4 py-2 bg-mm-dark rounded text-mm-text">
              Страница {page}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={productsWithPhotos.length < 50}
              className="px-4 py-2 bg-mm-secondary text-mm-text hover:bg-mm-secondary/80 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Вперёд
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
