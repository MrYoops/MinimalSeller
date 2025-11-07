import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiFolder, FiPlus } from 'react-icons/fi'

function CategoriesPage() {
  const { api } = useAuth()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newCategory, setNewCategory] = useState({ name: '', parent_id: null })

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/admin/categories')
      setCategories(response.data)
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
    setLoading(false)
  }

  const addCategory = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/admin/categories', null, {
        params: {
          name: newCategory.name,
          parent_id: newCategory.parent_id
        }
      })
      setShowAddModal(false)
      setNewCategory({ name: '', parent_id: null })
      loadCategories()
    } catch (error) {
      console.error('Failed to add category:', error)
    }
  }

  const deleteCategory = async (id) => {
    if (!confirm('Delete this category?')) return
    try {
      await api.delete(`/api/admin/categories/${id}`)
      loadCategories()
    } catch (error) {
      console.error('Failed to delete category:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl mb-2 text-mm-cyan uppercase">CATEGORIES</h2>
          <p className="comment">// Manage product categories</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
          data-testid="add-category-button"
        >
          <FiPlus className="inline mr-2" />
          ADD CATEGORY
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiFolder className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2">No categories yet</p>
          <p className="comment">// Click "ADD CATEGORY" to create first category</p>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-mm-border">
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Name</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Parent</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Created</th>
                  <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                    <td className="py-4 px-4 font-mono text-sm text-mm-cyan">{cat.name}</td>
                    <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                      {cat.parent_id || '-'}
                    </td>
                    <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                      {new Date(cat.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => deleteCategory(cat.id)}
                        className="px-3 py-1 border border-mm-red text-mm-red hover:bg-mm-red/10 transition-colors text-xs uppercase font-mono"
                      >
                        DELETE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card-neon max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl text-mm-cyan">ADD CATEGORY</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-mm-text-secondary hover:text-mm-red transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={addCategory} className="space-y-6">
              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Category Name</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                  className="input-neon w-full"
                  placeholder="Electronics"
                  required
                />
              </div>

              <div className="flex space-x-4">
                <button type="submit" className="btn-primary flex-1">
                  CREATE
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary flex-1"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CategoriesPage