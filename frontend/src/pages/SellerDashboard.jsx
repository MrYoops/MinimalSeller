import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiLogOut, FiKey, FiPackage, FiShoppingCart, FiBox, FiDollarSign, FiPieChart, FiLink } from 'react-icons/fi'
import SettingsDropdown from '../components/SettingsDropdown'
import APIKeysPage from './APIKeysPage'
import OrdersPage from './OrdersPage'
import InventoryPage from './InventoryPage'
import FinanceDashboard from './FinanceDashboard'
import PayoutsPage from './PayoutsPage'
import ProductMappingPage from './ProductMappingPage'

function SellerDashboard() {
  const { user, logout, api } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('products')

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
      <header className="border-b border-mm-border bg-mm-darker">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">
              MINIMAL<span className="text-mm-purple">MOD</span> <span className="status-new">SELLER</span>
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-mm-text-secondary">{user?.email}</span>
              <SettingsDropdown />
              <button onClick={logout} className="btn-primary">LOGOUT</button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-mm-border bg-mm-dark">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-6 h-12 overflow-x-auto">
            <button
              onClick={() => setActiveTab('api-keys')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
                activeTab === 'api-keys' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiKey className="inline mr-2" />ИНТЕГРАЦИИ
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
                activeTab === 'products' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiPackage className="inline mr-2" />PRODUCTS
            </button>
            <button
              onClick={() => setActiveTab('mapping')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
                activeTab === 'mapping' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiLink className="inline mr-2" />СОПОСТАВЛЕНИЕ
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
                activeTab === 'orders' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiShoppingCart className="inline mr-2" />ORDERS
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
                activeTab === 'inventory' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiBox className="inline mr-2" />INVENTORY
            </button>
            <button
              onClick={() => setActiveTab('finance')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
                activeTab === 'finance' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiPieChart className="inline mr-2" />FINANCE
            </button>
            <button
              onClick={() => setActiveTab('balance')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
                activeTab === 'balance' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiDollarSign className="inline mr-2" />BALANCE
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'api-keys' && <APIKeysPage />}
        
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl mb-2 text-mm-cyan">PRODUCTS</h2>
              <button onClick={() => window.location.href = '/products/new/edit'} className="btn-primary">
                + ADD PRODUCT
              </button>
            </div>
            
            {loading ? (
              <div className="text-center py-12"><p className="text-mm-cyan animate-pulse">// LOADING...</p></div>
            ) : products.length === 0 ? (
              <div className="card-neon text-center py-12">
                <FiPackage className="mx-auto text-mm-text-tertiary mb-4" size={48} />
                <p className="text-mm-text-secondary">No products yet</p>
              </div>
            ) : (
              <div className="card-neon overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-mm-border">
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Photo</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">SKU</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Name</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Price</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Status</th>
                      <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm">Actions</th>
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
                              <span className="text-xs">NO IMG</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 font-mono text-sm text-mm-cyan">{product.sku}</td>
                        <td className="py-4 px-4">{product.minimalmod.name}</td>
                        <td className="py-4 px-4 font-mono">₽{product.price}</td>
                        <td className="py-4 px-4">
                          <span className={product.status === 'active' ? 'status-active' : 'status-pending'}>
                            {product.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => window.location.href = `/products/${product.id}/edit`}
                            className="btn-primary text-xs"
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

        {activeTab === 'mapping' && <ProductMappingPage />}
        {activeTab === 'orders' && <OrdersPage />}
        {activeTab === 'inventory' && <InventoryPage />}
        {activeTab === 'finance' && <FinanceDashboard />}
        {activeTab === 'balance' && <PayoutsPage />}
      </main>
    </div>
  )
}

export default SellerDashboard