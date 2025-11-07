import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiLogOut, FiUsers, FiKey, FiActivity, FiPackage, FiShoppingCart, FiBox, FiDollarSign, FiSettings, FiFolder } from 'react-icons/fi'
import OrdersPage from './OrdersPage'
import InventoryPage from './InventoryPage'
import SettingsDropdown from '../components/SettingsDropdown'
import AdminGlobalDashboard from './AdminGlobalDashboard'
import CategoriesPage from './CategoriesPage'
import PayoutsPage from './PayoutsPage'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from '../i18n/translations'

function AdminDashboard() {
  const { user, logout, api } = useAuth()
  const { language } = useTheme()
  const { t } = useTranslation(language)
  const [users, setUsers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')

  useEffect(() => {
    loadUsers()
    loadProducts()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/admin/users')
      setUsers(response.data)
    } catch (error) {
      console.error('Failed to load users:', error)
    }
    setLoading(false)
  }

  const approveUser = async (userId) => {
    try {
      await api.put(`/api/admin/users/${userId}/approve`)
      loadUsers()
    } catch (error) {
      console.error('Failed to approve user:', error)
    }
  }

  const blockUser = async (userId) => {
    try {
      await api.put(`/api/admin/users/${userId}/block`)
      loadUsers()
    } catch (error) {
      console.error('Failed to block user:', error)
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

  const getQualityColor = (score) => {
    if (score >= 80) return 'text-mm-green'
    if (score >= 50) return 'text-mm-yellow'
    return 'text-mm-red'
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
              <span className="status-active">{t('adminPanel')}</span>
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
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 font-mono uppercase tracking-wider text-sm transition-colors ${
                activeTab === 'dashboard'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
              data-testid="tab-dashboard"
            >
              <FiActivity className="inline mr-2" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 font-mono uppercase tracking-wider text-sm transition-colors ${
                activeTab === 'users'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
              data-testid="tab-users"
            >
              <FiUsers className="inline mr-2" />
              Sellers
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
              Products
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
              Orders
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
              Inventory
            </button>
            <button
              onClick={() => setActiveTab('payouts')}
              className={`px-4 font-mono uppercase tracking-wider text-sm transition-colors ${
                activeTab === 'payouts'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
              data-testid="tab-payouts"
            >
              <FiDollarSign className="inline mr-2" />
              Payouts
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-4 font-mono uppercase tracking-wider text-sm transition-colors ${
                activeTab === 'categories'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
              data-testid="tab-categories"
            >
              <FiFolder className="inline mr-2" />
              Categories
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'users' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl mb-2 text-mm-cyan">USER MANAGEMENT</h2>
              <p className="comment">// Approve, block or manage sellers</p>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-mm-cyan animate-pulse">// LOADING...</p>
              </div>
            ) : (
              <div className="card-neon overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="users-table">
                    <thead>
                      <tr className="border-b border-mm-border">
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Email</th>
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Name</th>
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Role</th>
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Status</th>
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Registered</th>
                        <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                          <td className="py-4 px-4 font-mono text-sm">{u.email}</td>
                          <td className="py-4 px-4 font-mono text-sm">{u.full_name}</td>
                          <td className="py-4 px-4">
                            <span className={u.role === 'admin' ? 'status-active' : 'status-new'}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={u.is_active ? 'status-active' : 'status-pending'}>
                              {u.is_active ? 'ACTIVE' : 'PENDING'}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-4 text-right space-x-2">
                            {!u.is_active && u.role === 'seller' && (
                              <button
                                onClick={() => approveUser(u.id)}
                                className="px-3 py-1 border border-mm-green text-mm-green hover:bg-mm-green/10 transition-colors text-xs uppercase font-mono"
                                data-testid={`approve-user-${u.id}`}
                              >
                                Approve
                              </button>
                            )}
                            {u.is_active && u.role === 'seller' && (
                              <button
                                onClick={() => blockUser(u.id)}
                                className="px-3 py-1 border border-mm-red text-mm-red hover:bg-mm-red/10 transition-colors text-xs uppercase font-mono"
                                data-testid={`block-user-${u.id}`}
                              >
                                Block
                              </button>
                            )}
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

        {activeTab === 'analytics' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl mb-2 text-mm-cyan">ANALYTICS</h2>
              <p className="comment">// Platform statistics and metrics</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card-neon">
                <p className="comment mb-2">// Total Users</p>
                <p className="text-4xl font-bold text-mm-green">{users.length}</p>
              </div>
              
              <div className="card-neon">
                <p className="comment mb-2">// Active Sellers</p>
                <p className="text-4xl font-bold text-mm-cyan">
                  {users.filter(u => u.role === 'seller' && u.is_active).length}
                </p>
              </div>
              
              <div className="card-neon">
                <p className="comment mb-2">// Pending Approval</p>
                <p className="text-4xl font-bold text-mm-yellow">
                  {users.filter(u => !u.is_active).length}
                </p>
              </div>
            </div>

            <div className="mt-8 card-neon">
              <p className="comment mb-4">// Coming soon:</p>
              <ul className="space-y-2 text-mm-text-secondary font-mono text-sm">
                <li>• Revenue analytics</li>
                <li>• Orders statistics</li>
                <li>• Marketplace performance</li>
                <li>• Commission tracking</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl mb-2 text-mm-cyan">ALL PRODUCTS</h2>
              <p className="comment">// View all products from all sellers</p>
            </div>

            {products.length === 0 ? (
              <div className="card-neon text-center py-12">
                <FiPackage className="mx-auto text-mm-text-tertiary mb-4" size={48} />
                <p className="text-mm-text-secondary mb-2">No products in system</p>
                <p className="comment">// Sellers haven't created any products yet</p>
              </div>
            ) : (
              <div className="card-neon overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="admin-products-table">
                    <thead>
                      <tr className="border-b border-mm-border">
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Seller</th>
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">SKU</th>
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Name</th>
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Price</th>
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Status</th>
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Quality</th>
                        <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                          <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                            {product.seller_id.substring(0, 8)}...
                          </td>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 p-4 bg-mm-darker border-t border-mm-border">
                  <p className="comment mb-2">// Statistics:</p>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-mm-cyan">{products.length}</p>
                      <p className="text-xs text-mm-text-secondary">Total Products</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-mm-green">
                        {products.filter(p => p.status === 'active').length}
                      </p>
                      <p className="text-xs text-mm-text-secondary">Active</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-mm-yellow">
                        {products.filter(p => p.status === 'draft').length}
                      </p>
                      <p className="text-xs text-mm-text-secondary">Drafts</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-mm-purple">
                        {Math.round(products.reduce((sum, p) => sum + p.listing_quality_score.total, 0) / products.length || 0)}
                      </p>
                      <p className="text-xs text-mm-text-secondary">Avg Quality</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl mb-2 text-mm-cyan">ALL ORDERS</h2>
              <p className="comment">// View orders from all sellers</p>
            </div>
            <OrdersPage />
          </div>
        )}

        {activeTab === 'inventory' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl mb-2 text-mm-cyan">GLOBAL INVENTORY</h2>
              <p className="comment">// View inventory from all sellers</p>
            </div>
            <InventoryPage />
          </div>
        )}

        {activeTab === 'dashboard' && (
          <AdminGlobalDashboard />
        )}

        {activeTab === 'payouts' && (
          <PayoutsPage isAdmin={true} />
        )}

        {activeTab === 'categories' && (
          <CategoriesPage />
        )}
      </main>
    </div>
  )
}

export default AdminDashboard