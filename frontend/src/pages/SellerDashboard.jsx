import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiLogOut, FiKey, FiPackage, FiShoppingCart, FiBox, FiDollarSign, FiPieChart } from 'react-icons/fi'
import SettingsDropdown from '../components/SettingsDropdown'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from '../i18n/translations'
import APIKeysPage from './APIKeysPage'

function SellerDashboard() {
  const { user, logout, api } = useAuth()
  const { language } = useTheme()
  const { t } = useTranslation(language)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      const response = await api.get('/api/products')
      setProducts(response.data)
    } catch (error) {
      console.error('Failed to load products:', error)
    }
    setLoading(false)
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
          <div className="flex space-x-8 h-12 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 font-mono uppercase tracking-wider text-sm transition-colors whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiDollarSign className="inline mr-2" />
              {t('overview')}
            </button>
            <button
              onClick={() => setActiveTab('api-keys')}
              className={`px-4 font-mono uppercase tracking-wider text-sm transition-colors whitespace-nowrap ${
                activeTab === 'api-keys'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiKey className="inline mr-2" />
              API KEYS
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 font-mono uppercase tracking-wider text-sm transition-colors whitespace-nowrap ${
                activeTab === 'products'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiPackage className="inline mr-2" />
              {t('products')}
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 font-mono uppercase tracking-wider text-sm transition-colors whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiShoppingCart className="inline mr-2" />
              {t('orders')}
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-4 font-mono uppercase tracking-wider text-sm transition-colors whitespace-nowrap ${
                activeTab === 'inventory'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiBox className="inline mr-2" />
              {t('inventory')}
            </button>
            <button
              onClick={() => setActiveTab('finance')}
              className={`px-4 font-mono uppercase tracking-wider text-sm transition-colors whitespace-nowrap ${
                activeTab === 'finance'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiPieChart className="inline mr-2" />
              Finance
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h2 className="text-2xl mb-2 text-mm-cyan">DASHBOARD</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="card-neon">
                <p className="comment mb-2">// Products</p>
                <p className="text-3xl font-bold text-mm-purple">{products.length}</p>
              </div>
              <div className="card-neon">
                <p className="comment mb-2">// Orders</p>
                <p className="text-3xl font-bold text-mm-cyan">3</p>
              </div>
              <div className="card-neon">
                <p className="comment mb-2">// Revenue</p>
                <p className="text-3xl font-bold text-mm-green">₽90,540</p>
              </div>
              <div className="card-neon">
                <p className="comment mb-2">// Profit</p>
                <p className="text-3xl font-bold text-mm-green">₽29,085</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl mb-2 text-mm-cyan">PRODUCTS</h2>
              <button
                onClick={() => window.location.href = '/products/new/edit'}
                className="btn-primary"
              >
                + ADD PRODUCT
              </button>
            </div>
            
            {products.length === 0 ? (
              <div className="card-neon text-center py-12">
                <FiPackage className="mx-auto text-mm-text-tertiary mb-4" size={48} />
                <p className="text-mm-text-secondary">No products yet</p>
              </div>
            ) : (
              <div className="card-neon overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-mm-border">
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Photo</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">SKU</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Name</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Price</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Status</th>
                      <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-b border-mm-border hover:bg-mm-gray">
                        <td className="py-4 px-4">
                          {product.minimalmod.images?.[0] ? (
                            <img src={product.minimalmod.images[0]} alt="" className="w-16 h-16 object-cover border border-mm-border" />
                          ) : (
                            <div className="w-16 h-16 bg-mm-gray border border-mm-border flex items-center justify-center">
                              <span className="text-xs text-mm-text-tertiary">NO IMG</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 font-mono text-sm text-mm-cyan">{product.sku}</td>
                        <td className="py-4 px-4 font-mono text-sm">{product.minimalmod.name}</td>
                        <td className="py-4 px-4 font-mono text-sm">₽{product.price.toLocaleString()}</td>
                        <td className="py-4 px-4">
                          <span className={product.status === 'active' ? 'status-active' : 'status-pending'}>
                            {product.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right space-x-2">
                          <button
                            onClick={() => window.location.href = `/products/${product.id}/edit`}
                            className="px-3 py-1 border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 text-xs uppercase font-mono"
                          >
                            EDIT
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="card-neon text-center py-12">
            <FiShoppingCart className="mx-auto text-mm-text-tertiary mb-4" size={48} />
            <p className="text-mm-text-secondary">Orders module</p>
            <p className="comment">// Coming soon</p>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="card-neon text-center py-12">
            <FiBox className="mx-auto text-mm-text-tertiary mb-4" size={48} />
            <p className="text-mm-text-secondary">Inventory module</p>
            <p className="comment">// Coming soon</p>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="card-neon text-center py-12">
            <FiPieChart className="mx-auto text-mm-text-tertiary mb-4" size={48} />
            <p className="text-mm-text-secondary">Finance module</p>
            <p className="comment">// Coming soon</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default SellerDashboard