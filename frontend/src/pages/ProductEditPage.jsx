import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiSave, FiX, FiImage, FiTag } from 'react-icons/fi'

function ProductEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { api } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('minimalmod')
  const [showMarketplaces, setShowMarketplaces] = useState(false)
  const [categories, setCategories] = useState([])
  const [product, setProduct] = useState({
    sku: '',
    price: '',
    status: 'draft',
    visibility: {
      show_on_minimalmod: true,
      show_in_search: true,
      is_featured: false
    },
    seo: {
      meta_title: '',
      meta_description: '',
      url_slug: ''
    },
    minimalmod: {
      name: '',
      variant_name: '',
      description: '',
      tags: [],
      images: [],
      attributes: {}
    },
    marketplaces: {
      images: [],
      ozon: { enabled: false, name: '', description: '', category_id: '', attributes: {} },
      wildberries: { enabled: false, name: '', description: '', category_id: '', attributes: {} },
      yandex_market: { enabled: false, name: '', description: '', category_id: '', attributes: {} }
    }
  })

  useEffect(() => {
    loadCategories()
    if (id !== 'new') {
      loadProduct()
    } else {
      setLoading(false)
    }
  }, [id])

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/admin/categories')
      setCategories(response.data)
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const loadProduct = async () => {
    try {
      const response = await api.get(`/api/products/${id}`)
      setProduct(response.data)
    } catch (error) {
      console.error('Failed to load product:', error)
      alert('Failed to load product')
    }
    setLoading(false)
  }

  const handleSave = async () => {
    try {
      if (id === 'new') {
        await api.post('/api/products', product)
        alert('Product created successfully!')
      } else {
        await api.put(`/api/products/${id}`, product)
        alert('Product updated successfully!')
      }
      navigate(-1)
    } catch (error) {
      console.error('Failed to save product:', error)
      alert('Failed to save: ' + (error.response?.data?.detail || error.message))
    }
  }

  const addTag = (tag) => {
    if (tag && !product.minimalmod.tags.includes(tag)) {
      setProduct({
        ...product,
        minimalmod: {
          ...product.minimalmod,
          tags: [...product.minimalmod.tags, tag]
        }
      })
    }
  }

  const removeTag = (tag) => {
    setProduct({
      ...product,
      minimalmod: {
        ...product.minimalmod,
        tags: product.minimalmod.tags.filter(t => t !== tag)
      }
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mm-black flex items-center justify-center">
        <p className="text-mm-cyan animate-pulse">// LOADING...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-mm-black">
      {/* Header */}
      <header className="border-b border-mm-border bg-mm-darker sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-mm-cyan uppercase">
              {id === 'new' ? 'Create Product' : 'Edit Product'}
            </h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleSave}
                className="btn-primary"
                data-testid="save-product-button"
              >
                <FiSave className="inline mr-2" />
                Save Product
              </button>
              <button
                onClick={() => navigate(-1)}
                className="btn-secondary"
                data-testid="cancel-button"
              >
                <FiX className="inline mr-2" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Left */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="flex space-x-4 border-b border-mm-border">
              <button
                onClick={() => setActiveTab('minimalmod')}
                className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
                  activeTab === 'minimalmod'
                    ? 'text-mm-cyan border-b-2 border-mm-cyan'
                    : 'text-mm-text-secondary hover:text-mm-cyan'
                }`}
              >
                MinimalMod
              </button>
              <button
                onClick={() => setActiveTab('marketplaces')}
                className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
                  activeTab === 'marketplaces'
                    ? 'text-mm-cyan border-b-2 border-mm-cyan'
                    : 'text-mm-text-secondary hover:text-mm-cyan'
                }`}
              >
                Marketplaces
              </button>
            </div>

            {/* MinimalMod Tab */}
            {activeTab === 'minimalmod' && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="card-neon">
                  <h3 className="text-xl mb-4 text-mm-cyan uppercase">Basic Information</h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-2 text-mm-text-secondary uppercase">SKU *</label>
                        <input
                          type="text"
                          value={product.sku}
                          onChange={(e) => setProduct({...product, sku: e.target.value})}
                          className="input-neon w-full"
                          placeholder="PRODUCT-NAME-db15"
                          data-testid="sku-input"
                        />
                        <p className="comment text-xs mt-1">// Unique product identifier</p>
                      </div>
                      <div>
                        <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Price *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={product.price}
                          onChange={(e) => setProduct({...product, price: parseFloat(e.target.value)})}
                          className="input-neon w-full"
                          placeholder="1500.00"
                          data-testid="price-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Name *</label>
                      <input
                        type="text"
                        value={product.minimalmod.name}
                        onChange={(e) => setProduct({
                          ...product,
                          minimalmod: {...product.minimalmod, name: e.target.value}
                        })}
                        className="input-neon w-full"
                        placeholder="Product Name"
                        data-testid="name-input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Variant Name</label>
                      <input
                        type="text"
                        value={product.minimalmod.variant_name}
                        onChange={(e) => setProduct({
                          ...product,
                          minimalmod: {...product.minimalmod, variant_name: e.target.value}
                        })}
                        className="input-neon w-full"
                        placeholder="e.g. Red, Large"
                      />
                    </div>

                    <div>
                      <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Description</label>
                      <textarea
                        value={product.minimalmod.description}
                        onChange={(e) => setProduct({
                          ...product,
                          minimalmod: {...product.minimalmod, description: e.target.value}
                        })}
                        className="input-neon w-full"
                        rows="6"
                        placeholder="Detailed product description..."
                        data-testid="description-input"
                      />
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="block text-sm mb-2 text-mm-text-secondary uppercase">
                        <FiTag className="inline mr-2" />
                        Tags
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {product.minimalmod.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 text-sm font-mono border border-mm-cyan text-mm-cyan flex items-center"
                          >
                            {tag}
                            <button
                              onClick={() => removeTag(tag)}
                              className="ml-2 text-mm-red hover:text-mm-red/80"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <input
                        type="text"
                        className="input-neon w-full"
                        placeholder="Add tag and press Enter"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addTag(e.target.value.trim())
                            e.target.value = ''
                          }
                        }}
                      />
                      <p className="comment text-xs mt-1">// Tags extracted from SKU will be added automatically</p>
                    </div>
                  </div>
                </div>

                {/* Images */}
                <div className="card-neon">
                  <h3 className="text-xl mb-4 text-mm-cyan uppercase">
                    <FiImage className="inline mr-2" />
                    Images (up to 8)
                  </h3>
                  <p className="comment mb-4">// Enter image URLs (one per line)</p>
                  <textarea
                    value={product.minimalmod.images.join('\n')}
                    onChange={(e) => setProduct({
                      ...product,
                      minimalmod: {
                        ...product.minimalmod,
                        images: e.target.value.split('\n').filter(url => url.trim())
                      }
                    })}
                    className="input-neon w-full"
                    rows="4"
                    placeholder="https://example.com/image1.jpg"
                  />
                </div>
              </div>
            )}

            {/* Marketplaces Tab */}
            {activeTab === 'marketplaces' && (
              <div className="space-y-6">
                {/* Marketplace Images */}
                <div className="card-neon">
                  <h3 className="text-xl mb-4 text-mm-cyan uppercase">Marketplace Images (up to 10)</h3>
                  <textarea
                    value={product.marketplaces.images.join('\n')}
                    onChange={(e) => setProduct({
                      ...product,
                      marketplaces: {
                        ...product.marketplaces,
                        images: e.target.value.split('\n').filter(url => url.trim())
                      }
                    })}
                    className="input-neon w-full"
                    rows="5"
                    placeholder="https://example.com/marketplace-image1.jpg"
                  />
                </div>

                {/* Ozon */}
                <div className="card-neon">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl text-mm-cyan uppercase">Ozon</h3>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={product.marketplaces.ozon.enabled}
                        onChange={(e) => setProduct({
                          ...product,
                          marketplaces: {
                            ...product.marketplaces,
                            ozon: {...product.marketplaces.ozon, enabled: e.target.checked}
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <span className="text-mm-text-secondary">Publish to Ozon</span>
                    </label>
                  </div>
                  
                  {product.marketplaces.ozon.enabled && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Name</label>
                        <input
                          type="text"
                          value={product.marketplaces.ozon.name}
                          onChange={(e) => setProduct({
                            ...product,
                            marketplaces: {
                              ...product.marketplaces,
                              ozon: {...product.marketplaces.ozon, name: e.target.value}
                            }
                          })}
                          className="input-neon w-full"
                          placeholder="Optimized name for Ozon"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Description</label>
                        <textarea
                          value={product.marketplaces.ozon.description}
                          onChange={(e) => setProduct({
                            ...product,
                            marketplaces: {
                              ...product.marketplaces,
                              ozon: {...product.marketplaces.ozon, description: e.target.value}
                            }
                          })}
                          className="input-neon w-full"
                          rows="4"
                          placeholder="Optimized description for Ozon"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Wildberries */}
                <div className="card-neon">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl text-mm-cyan uppercase">Wildberries</h3>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={product.marketplaces.wildberries.enabled}
                        onChange={(e) => setProduct({
                          ...product,
                          marketplaces: {
                            ...product.marketplaces,
                            wildberries: {...product.marketplaces.wildberries, enabled: e.target.checked}
                          }
                        })}
                        className="w-4 h-4"
                      />
                      <span className="text-mm-text-secondary">Publish to Wildberries</span>
                    </label>
                  </div>
                  
                  {product.marketplaces.wildberries.enabled && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Name</label>
                        <input
                          type="text"
                          value={product.marketplaces.wildberries.name}
                          onChange={(e) => setProduct({
                            ...product,
                            marketplaces: {
                              ...product.marketplaces,
                              wildberries: {...product.marketplaces.wildberries, name: e.target.value}
                            }
                          })}
                          className="input-neon w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Description</label>
                        <textarea
                          value={product.marketplaces.wildberries.description}
                          onChange={(e) => setProduct({
                            ...product,
                            marketplaces: {
                              ...product.marketplaces,
                              wildberries: {...product.marketplaces.wildberries, description: e.target.value}
                            }
                          })}
                          className="input-neon w-full"
                          rows="4"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Right */}
          <div className="lg:col-span-1 space-y-6">
            {/* Status */}
            <div className="card-neon">
              <h3 className="text-lg mb-4 text-mm-cyan uppercase">Status</h3>
              <select
                value={product.status}
                onChange={(e) => setProduct({...product, status: e.target.value})}
                className="input-neon w-full"
                data-testid="status-select"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="out_of_stock">Out of Stock</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {/* Visibility */}
            <div className="card-neon">
              <h3 className="text-lg mb-4 text-mm-cyan uppercase">Visibility</h3>
              <div className="space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={product.visibility.show_on_minimalmod}
                    onChange={(e) => setProduct({
                      ...product,
                      visibility: {...product.visibility, show_on_minimalmod: e.target.checked}
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-mm-text-secondary">Show on MinimalMod</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={product.visibility.show_in_search}
                    onChange={(e) => setProduct({
                      ...product,
                      visibility: {...product.visibility, show_in_search: e.target.checked}
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-mm-text-secondary">Show in search</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={product.visibility.is_featured}
                    onChange={(e) => setProduct({
                      ...product,
                      visibility: {...product.visibility, is_featured: e.target.checked}
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-mm-text-secondary">Featured</span>
                </label>
              </div>
            </div>

            {/* SEO */}
            <div className="card-neon">
              <h3 className="text-lg mb-4 text-mm-cyan uppercase">SEO</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Meta Title</label>
                  <input
                    type="text"
                    value={product.seo.meta_title}
                    onChange={(e) => setProduct({
                      ...product,
                      seo: {...product.seo, meta_title: e.target.value}
                    })}
                    className="input-neon w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2 text-mm-text-secondary uppercase">URL Slug</label>
                  <input
                    type="text"
                    value={product.seo.url_slug}
                    onChange={(e) => setProduct({
                      ...product,
                      seo: {...product.seo, url_slug: e.target.value}
                    })}
                    className="input-neon w-full"
                  />
                  <p className="comment text-xs mt-1">// Auto-generated from name</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductEditPage
