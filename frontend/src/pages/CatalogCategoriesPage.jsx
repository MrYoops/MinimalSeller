import React, { useState, useEffect } from 'react'
import { FiPlus, FiEdit, FiTrash2, FiArrowLeft } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

export default function CatalogCategoriesPage() {
  const { api } = useAuth()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    group_by_color: false,
    group_by_size: false,
    common_attributes: {}
  })

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/catalog/categories')
      setCategories(response.data)
    } catch (error) {
      console.error('Failed to load categories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingCategory) {
        await api.put(`/api/catalog/categories/${editingCategory.id}`, formData)
      } else {
        await api.post('/api/catalog/categories', formData)
      }
      setShowForm(false)
      setEditingCategory(null)
      setFormData({ name: '', group_by_color: false, group_by_size: false, common_attributes: {} })
      loadCategories()
    } catch (error) {
      alert('Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleEdit = (category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      group_by_color: category.group_by_color,
      group_by_size: category.group_by_size,
      common_attributes: category.common_attributes || {}
    })
    setShowForm(true)
  }

  const handleDelete = async (categoryId) => {
    if (!window.confirm('Вы уверены, что хотите удалить эту категорию?')) return
    
    try {
      await api.delete(`/api/catalog/categories/${categoryId}`)
      loadCategories()
    } catch (error) {
      alert('Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingCategory(null)
    setFormData({ name: '', group_by_color: false, group_by_size: false, common_attributes: {} })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="text-mm-cyan hover:underline mb-2 flex items-center gap-2"
          >
            <FiArrowLeft /> Назад к товарам
          </button>
          <h1 className="text-3xl font-bold text-mm-cyan">КАТЕГОРИИ ТОВАРОВ</h1>
          <p className="text-sm text-mm-text-secondary mt-1">Управление категориями</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded flex items-center gap-2"
          >
            <FiPlus /> СОЗДАТЬ КАТЕГОРИЮ
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-mm-secondary p-6 rounded-lg">
          <h2 className="text-xl font-bold text-mm-text mb-4">
            {editingCategory ? 'Редактировать категорию' : 'Новая категория'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-mm-text-secondary mb-1">
                Название категории <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                placeholder="Например: Одежда, Обувь, Аксессуары"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-mm-dark rounded">
                <input
                  type="checkbox"
                  id="group_by_color"
                  checked={formData.group_by_color}
                  onChange={(e) => setFormData({ ...formData, group_by_color: e.target.checked })}
                  className="w-5 h-5 accent-mm-cyan"
                />
                <label htmlFor="group_by_color" className="text-mm-text cursor-pointer flex-1">
                  <div className="font-medium">Разделять товары по цвету</div>
                  <div className="text-xs text-mm-text-secondary mt-1">
                    В карточке будет переключатель цветов (или вкусов, принтов)
                  </div>
                </label>
              </div>

              <div className="flex items-center gap-3 p-3 bg-mm-dark rounded">
                <input
                  type="checkbox"
                  id="group_by_size"
                  checked={formData.group_by_size}
                  onChange={(e) => setFormData({ ...formData, group_by_size: e.target.checked })}
                  className="w-5 h-5 accent-mm-cyan"
                />
                <label htmlFor="group_by_size" className="text-mm-text cursor-pointer flex-1">
                  <div className="font-medium">Разделять товары по размеру</div>
                  <div className="text-xs text-mm-text-secondary mt-1">
                    В карточке будет таблица размеров с параметрами
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
              <p className="text-xs text-blue-300">
                💡 <strong>Совет:</strong> Для категорий "Одежда" и "Обувь" рекомендуется включить оба параметра.
                Это позволит создавать объединенные карточки как на маркетплейсах (WB, Ozon).
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 bg-mm-dark text-mm-text hover:bg-mm-dark/80 rounded"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded"
              >
                {editingCategory ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Categories List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-mm-cyan"></div>
          <p className="text-mm-text-secondary mt-4">Загрузка категорий...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 bg-mm-secondary rounded-lg">
          <p className="text-mm-text-secondary text-lg">Нет категорий</p>
          <p className="text-mm-text-secondary text-sm mt-2">Создайте первую категорию</p>
        </div>
      ) : (
        <div className="bg-mm-secondary rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-mm-dark border-b border-mm-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Название</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Разделение</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Товаров</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mm-border">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-mm-dark/50 transition">
                  <td className="px-4 py-3 text-mm-text font-medium">{category.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {category.group_by_color && (
                        <span className="px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400">
                          По цвету
                        </span>
                      )}
                      {category.group_by_size && (
                        <span className="px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400">
                          По размеру
                        </span>
                      )}
                      {!category.group_by_color && !category.group_by_size && (
                        <span className="text-xs text-mm-text-secondary">Нет разделения</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-mm-text">
                    <span className="text-mm-cyan">{category.products_count}</span> шт.
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(category)}
                        className="p-2 text-mm-cyan hover:bg-mm-cyan/10 rounded transition"
                        title="Редактировать"
                      >
                        <FiEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(category.id)}
                        disabled={category.products_count > 0}
                        className="p-2 text-red-400 hover:bg-red-400/10 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title={category.products_count > 0 ? 'Нельзя удалить - есть товары' : 'Удалить'}
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
    </div>
  )
}
