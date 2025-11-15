import React, { useState, useEffect } from 'react'
import { FiPlus, FiSearch, FiFilter, FiDownload, FiUpload, FiEdit, FiTrash2, FiPackage } from 'react-icons/fi'
import api from '../api'

export default function CatalogProductsPage() {
  const [products, setProducts] = useState([])
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
      setProducts(response.data)
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (productId) => {
    if (!window.confirm('Вы уверены, что хотите архивировать этот товар?')) return
    
    try {
      await api.delete(`/api/catalog/products/${productId}`)
      loadProducts()
    } catch (error) {
      alert('Ошибка при архивировании товара: ' + error.message)
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
            onClick={() => window.location.href = '/catalog/import'}
            className="px-4 py-2 bg-mm-secondary text-mm-text hover:bg-mm-secondary/80 rounded flex items-center gap-2"
          >
            <FiUpload /> ИМПОРТ ТОВАРОВ
          </button>
          <button
            onClick={() => window.location.href = '/catalog/categories'}
            className="px-4 py-2 bg-mm-secondary text-mm-text hover:bg-mm-secondary/80 rounded flex items-center gap-2"
          >
            <FiPackage /> КАТЕГОРИИ
          </button>
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
      ) : products.length === 0 ? (
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
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Бренд</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Категория</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Вариаций</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mm-border">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-mm-dark/50 transition">
                  <td className="px-4 py-3">
                    <div className="w-12 h-12 bg-mm-dark rounded flex items-center justify-center">
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
                        title="Архивировать"
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
      {products.length > 0 && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-mm-text-secondary">
            Показано товаров: {products.length}
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
              disabled={products.length < 50}
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
