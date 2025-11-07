import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiLogOut, FiKey, FiPackage, FiShoppingCart, FiDollarSign, FiBox } from 'react-icons/fi'
import OrdersPage from './OrdersPage'
import InventoryPage from './InventoryPage'
import SettingsDropdown from '../components/SettingsDropdown'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from '../i18n/translations'

function SellerDashboard() {
  const { user, logout, api } = useAuth()
  const { language } = useTheme()
  const { t } = useTranslation(language)
  const [apiKeys, setApiKeys] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showAddKeyModal, setShowAddKeyModal] = useState(false)
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [newKey, setNewKey] = useState({
    marketplace: 'ozon',
    client_id: '',
    api_key: ''
  })
  const [newProduct, setNewProduct] = useState({
    sku: '',
    name: '',
    description: '',
    price: '',
    status: 'draft'
  })

  useEffect(() => {
    loadApiKeys()
    loadProducts()
  }, [])

  const loadApiKeys = async () => {
    try {
      const response = await api.get('/api/seller/api-keys')
      setApiKeys(response.data)
    } catch (error) {
      console.error('Failed to load API keys:', error)
    }
    setLoading(false)
  }

  const addApiKey = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/seller/api-keys', newKey)
      setShowAddKeyModal(false)
      setNewKey({ marketplace: 'ozon', client_id: '', api_key: '' })
      loadApiKeys()
    } catch (error) {
      console.error('Failed to add API key:', error)
    }
  }

  const deleteApiKey = async (keyId) => {
    if (!confirm('Delete this API key?')) return
    try {
      await api.delete(`/api/seller/api-keys/${keyId}`)
      loadApiKeys()
    } catch (error) {
      console.error('Failed to delete API key:', error)
    }
  }

  const loadProducts = async () => {
    try {
      const response = await api.get('/api/products')
      setProducts(response.data)
    } catch (error) {
      console.error('Failed to load products:', error)
    }
  }

  const addProduct = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/products', {
        sku: newProduct.sku,
        price: parseFloat(newProduct.price),
        status: newProduct.status,
        minimalmod: {
          name: newProduct.name,
          description: newProduct.description,
          tags: [],
          images: [],
          attributes: {}
        }
      })
      setShowAddProductModal(false)
      setNewProduct({ sku: '', name: '', description: '', price: '', status: 'draft' })
      loadProducts()
    } catch (error) {
      console.error('Failed to add product:', error)
      alert('Failed to add product: ' + (error.response?.data?.detail || error.message))
    }
  }

  const deleteProduct = async (productId) => {
    if (!confirm('Delete this product?')) return
    try {
      await api.delete(`/api/products/${productId}`)
      loadProducts()
    } catch (error) {
      console.error('Failed to delete product:', error)
    }
  }

  const getQualityColor = (score) => {
    if (score >= 80) return 'text-mm-green'
    if (score >= 50) return 'text-mm-yellow'
    return 'text-mm-red'
  }

  const getQualityLabel = (score) => {
    if (score >= 80) return 'HIGH'
    if (score >= 50) return 'MEDIUM'
    return 'LOW'
  }

  return (
    <div className="min-h-screen bg-mm-black">
      {/* Header */}
      <header className="border-b border-mm-border bg-mm-darker">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold">
                MINIMAL<span className="text-mm-purple">MOD</span>
              </h1>
              <span className="status-new">{t('sellerPanel')}</span>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <p className="text-sm text-mm-text-secondary">// {user?.email}</p>
                <p className="text-xs comment">{user?.full_name}</p>
              </div>
              <SettingsDropdown />
              <button
                onClick={logout}
                className="btn-secondary p-2"
                data-testid="logout-button"
              >
                <FiLogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-mm-border bg-mm-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 h-12">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 font-mono uppercase tracking-wider text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
              data-testid="tab-overview"
            >
              <FiDollarSign className="inline mr-2" />
              {t('overview')}
            </button>
            <button
              onClick={() => setActiveTab('api-keys')}
              className={`px-4 font-mono uppercase tracking-wider text-sm transition-colors ${
                activeTab === 'api-keys'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
              data-testid="tab-api-keys"
            >
              <FiKey className="inline mr-2" />
              {t('apiKeys')}
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 font-mono uppercase tracking-wider text-sm transition-colors ${
                activeTab === 'products'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
              data-testid="tab-products"
            >
              <FiPackage className="inline mr-2" />
              {t('products')}
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 font-mono uppercase tracking-wider text-sm transition-colors ${
                activeTab === 'orders'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
              data-testid="tab-orders"
            >
              <FiShoppingCart className="inline mr-2" />
              {t('orders')}
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-4 font-mono uppercase tracking-wider text-sm transition-colors ${
                activeTab === 'inventory'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
              data-testid="tab-inventory"
            >
              <FiBox className="inline mr-2" />
              {t('inventory')}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl mb-2 text-mm-cyan">DASHBOARD</h2>
              <p className="comment">// Your sales overview</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="card-neon">
                <p className="comment mb-2">// Revenue (30d)</p>
                <p className="text-3xl font-bold text-mm-green">₽0</p>
              </div>
              
              <div className="card-neon">
                <p className="comment mb-2">// Orders (30d)</p>
                <p className="text-3xl font-bold text-mm-cyan">0</p>
              </div>
              
              <div className="card-neon">
                <p className="comment mb-2">// Products</p>
                <p className="text-3xl font-bold text-mm-purple">{products.length}</p>
              </div>
              
              <div className="card-neon">
                <p className="comment mb-2">// Connected</p>
                <p className="text-3xl font-bold text-mm-yellow">{apiKeys.length}</p>
              </div>
            </div>

            <div className="card-neon">
              <h3 className="text-xl mb-4 text-mm-cyan">GETTING STARTED</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <span className="text-mm-purple font-bold text-xl">01</span>
                  <div>
                    <p className="font-mono text-mm-text">Connect your marketplaces</p>
                    <p className="comment text-sm">Add API keys for Ozon, Wildberries, or Yandex.Market</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <span className="text-mm-purple font-bold text-xl">02</span>
                  <div>
                    <p className="font-mono text-mm-text">Sync your products</p>
                    <p className="comment text-sm">Import products from connected marketplaces</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <span className="text-mm-purple font-bold text-xl">03</span>
                  <div>
                    <p className="font-mono text-mm-text">Start managing</p>
                    <p className="comment text-sm">Update stocks, prices, and track orders</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'api-keys' && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl mb-2 text-mm-cyan">API KEYS</h2>
                <p className="comment">// Manage marketplace integrations</p>
              </div>
              <button
                onClick={() => setShowAddKeyModal(true)}
                className="btn-primary"
                data-testid="add-api-key-button"
              >
                + ADD KEY
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-mm-cyan animate-pulse">// LOADING...</p>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="card-neon text-center py-12">
                <FiKey className="mx-auto text-mm-text-tertiary mb-4" size={48} />
                <p className="text-mm-text-secondary mb-2">No API keys added yet</p>
                <p className="comment">// Click "ADD KEY" to connect a marketplace</p>
              </div>
            ) : (
              <div className="space-y-4">
                {apiKeys.map((key) => (
                  <div key={key.id} className="card-neon flex items-center justify-between" data-testid={`api-key-${key.id}`}>
                    <div>
                      <p className="text-mm-cyan font-mono uppercase text-lg mb-1">{key.marketplace}</p>
                      <p className="text-sm text-mm-text-secondary">Client ID: {key.client_id}</p>
                      <p className="text-sm text-mm-text-secondary font-mono">API Key: {key.api_key_masked}</p>
                      <p className="comment text-xs mt-2">
                        Added: {new Date(key.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteApiKey(key.id)}
                      className="btn-secondary text-mm-red border-mm-red hover:bg-mm-red/10"
                      data-testid={`delete-api-key-${key.id}`}
                    >
                      DELETE
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl mb-2 text-mm-cyan">{t('productList')}</h2>
                <p className="comment">{t('manageProducts')}</p>
              </div>
              <button
                onClick={() => setShowAddProductModal(true)}
                className="btn-primary"
                data-testid="add-product-button"
              >
                {t('addProduct')}
              </button>
            </div>

            {products.length === 0 ? (
              <div className="card-neon text-center py-12">
                <FiPackage className="mx-auto text-mm-text-tertiary mb-4" size={48} />
                <p className="text-mm-text-secondary mb-2">No products yet</p>
                <p className="comment">// Click "ADD PRODUCT" to create your first product</p>
              </div>
            ) : (
              <div className="card-neon overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="products-table">
                    <thead>
                      <tr className="border-b border-mm-border">
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">{t('sku')}</th>
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">{t('name')}</th>
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">{t('price')}</th>
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">{t('status')}</th>
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">{t('quality')}</th>
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">{t('tags')}</th>
                        <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                          <td className="py-4 px-4 font-mono text-sm text-mm-cyan">{product.sku}</td>
                          <td className="py-4 px-4 font-mono text-sm">{product.minimalmod.name}</td>
                          <td className="py-4 px-4 font-mono text-sm">₽{product.price.toLocaleString()}</td>
                          <td className="py-4 px-4">
                            <span className={
                              product.status === 'active' ? 'status-active' :
                              product.status === 'draft' ? 'status-pending' :
                              'status-error'
                            }>
                              {product.status}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`font-mono text-sm ${getQualityColor(product.listing_quality_score.total)}`}>
                              {Math.round(product.listing_quality_score.total)}/100
                            </span>
                            <span className={`ml-2 text-xs ${getQualityColor(product.listing_quality_score.total)}`}>
                              {getQualityLabel(product.listing_quality_score.total)}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-wrap gap-1">
                              {product.minimalmod.tags.map((tag, idx) => (
                                <span key={idx} className="px-2 py-1 text-xs font-mono border border-mm-cyan text-mm-cyan">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right space-x-2">
                            <button
                              onClick={() => window.location.href = `/products/${product.id}/edit`}
                              className="px-3 py-1 border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 transition-colors text-xs uppercase font-mono"
                              data-testid={`edit-product-${product.id}`}
                            >
                              EDIT
                            </button>
                            <button
                              onClick={() => deleteProduct(product.id)}
                              className="px-3 py-1 border border-mm-red text-mm-red hover:bg-mm-red/10 transition-colors text-xs uppercase font-mono"
                              data-testid={`delete-product-${product.id}`}
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
          </div>
        )}

        {activeTab === 'orders' && (
          <OrdersPage />
        )}

        {activeTab === 'inventory' && (
          <InventoryPage />
        )}
      </main>

      {/* Add API Key Modal */}
      {showAddKeyModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card-neon max-w-lg w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl text-mm-cyan">ADD API KEY</h3>
              <button
                onClick={() => setShowAddKeyModal(false)}
                className="text-mm-text-secondary hover:text-mm-red transition-colors"
                data-testid="close-modal-button"
              >
                ✕
              </button>
            </div>

            <form onSubmit={addApiKey} className="space-y-6">
              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase tracking-wider">
                  Marketplace
                </label>
                <select
                  value={newKey.marketplace}
                  onChange={(e) => setNewKey({ ...newKey, marketplace: e.target.value })}
                  className="input-neon w-full"
                  data-testid="marketplace-select"
                >
                  <option value="ozon">Ozon</option>
                  <option value="wb">Wildberries</option>
                  <option value="yandex">Yandex.Market</option>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase tracking-wider">
                  Client ID
                </label>
                <input
                  type="text"
                  value={newKey.client_id}
                  onChange={(e) => setNewKey({ ...newKey, client_id: e.target.value })}
                  className="input-neon w-full"
                  placeholder="Enter client ID"
                  required
                  data-testid="client-id-input"
                />
              </div>

              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase tracking-wider">
                  API Key
                </label>
                <input
                  type="password"
                  value={newKey.api_key}
                  onChange={(e) => setNewKey({ ...newKey, api_key: e.target.value })}
                  className="input-neon w-full"
                  placeholder="Enter API key"
                  required
                  data-testid="api-key-input"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  data-testid="submit-api-key-button"
                >
                  ADD KEY
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddKeyModal(false)}
                  className="btn-secondary flex-1"
                  data-testid="cancel-button"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card-neon max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl text-mm-cyan">ADD PRODUCT</h3>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="text-mm-text-secondary hover:text-mm-red transition-colors"
                data-testid="close-product-modal-button"
              >
                ✕
              </button>
            </div>

            <form onSubmit={addProduct} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm mb-2 text-mm-text-secondary uppercase tracking-wider">
                    SKU *
                  </label>
                  <input
                    type="text"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    className="input-neon w-full"
                    placeholder="PRODUCT-NAME-db15"
                    required
                    data-testid="product-sku-input"
                  />
                  <p className="comment text-xs mt-1">// Unique product identifier</p>
                </div>

                <div>
                  <label className="block text-sm mb-2 text-mm-text-secondary uppercase tracking-wider">
                    Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    className="input-neon w-full"
                    placeholder="1500.00"
                    required
                    data-testid="product-price-input"
                  />
                  <p className="comment text-xs mt-1">// Product price in RUB</p>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase tracking-wider">
                  Name *
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="input-neon w-full"
                  placeholder="Product Name"
                  required
                  data-testid="product-name-input"
                />
              </div>

              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="input-neon w-full"
                  placeholder="Product description..."
                  rows="4"
                  data-testid="product-description-input"
                />
                <p className="comment text-xs mt-1">// Detailed product description</p>
              </div>

              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase tracking-wider">
                  Status
                </label>
                <select
                  value={newProduct.status}
                  onChange={(e) => setNewProduct({ ...newProduct, status: e.target.value })}
                  className="input-neon w-full"
                  data-testid="product-status-select"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  data-testid="submit-product-button"
                >
                  CREATE PRODUCT
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="btn-secondary flex-1"
                  data-testid="cancel-product-button"
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

export default SellerDashboard
