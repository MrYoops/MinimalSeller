import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiLogOut, FiKey, FiPackage, FiShoppingCart, FiBox, FiDollarSign, FiPieChart, FiUsers } from 'react-icons/fi'
import { BsBoxSeam } from 'react-icons/bs'
import SettingsDropdown from '../components/SettingsDropdown'
import IntegrationsPage from './IntegrationsPage'
import OrdersPage from './OrdersPage'
import FinanceDashboard from './FinanceDashboard'
import PayoutsPage from './PayoutsPage'
import WarehousesSection from './WarehousesSection'
import CatalogProductsPage from './CatalogProductsPage'

function SellersManagementTab() {
  const { api } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsers()
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
      console.error('Failed to approve:', error)
    }
  }

  const blockUser = async (userId) => {
    try {
      await api.put(`/api/admin/users/${userId}/block`)
      loadUsers()
    } catch (error) {
      console.error('Failed to block:', error)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl mb-4 text-mm-cyan">УПРАВЛЕНИЕ СЕЛЛЕРАМИ</h2>
      
      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-mm-border">
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Email</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Name</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Role</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Status</th>
                <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-mm-border hover:bg-mm-gray">
                  <td className="py-4 px-4 font-mono text-sm">{u.email}</td>
                  <td className="py-4 px-4">{u.full_name}</td>
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
                  <td className="py-4 px-4 text-right space-x-2">
                    {!u.is_active && u.role === 'seller' && (
                      <button
                        onClick={() => approveUser(u.id)}
                        className="px-3 py-1 border border-mm-green text-mm-green text-xs"
                      >
                        APPROVE
                      </button>
                    )}
                    {u.is_active && u.role === 'seller' && (
                      <button
                        onClick={() => blockUser(u.id)}
                        className="px-3 py-1 border border-mm-red text-mm-red text-xs"
                      >
                        BLOCK
                      </button>
                    )}
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

function AdminDashboardV2() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('products')

  return (
    <div className="min-h-screen bg-mm-black">
      <header className="border-b border-mm-border bg-mm-darker">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">
              MINIMAL<span className="text-mm-purple">MOD</span> <span className="status-active">ADMIN</span>
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
              onClick={() => setActiveTab('sellers')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
                activeTab === 'sellers' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
              data-testid="admin-tab-sellers"
            >
              <FiUsers className="inline mr-2" />СЕЛЛЕРЫ
            </button>
            <button
              onClick={() => setActiveTab('api-keys')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
                activeTab === 'api-keys' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
              data-testid="admin-tab-integrations"
            >
              <FiKey className="inline mr-2" />ИНТЕГРАЦИИ
            </button>
            <button
              onClick={() => setActiveTab('warehouses')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
                activeTab === 'warehouses' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
              data-testid="admin-tab-warehouses"
            >
              <BsBoxSeam className="inline mr-2" />СКЛАД
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
                activeTab === 'products' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
              data-testid="admin-tab-products"
            >
              <FiPackage className="inline mr-2" />ТОВАРЫ
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
                activeTab === 'orders' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
              data-testid="admin-tab-orders"
            >
              <FiShoppingCart className="inline mr-2" />ORDERS
            </button>
            <button
              onClick={() => setActiveTab('finance')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
                activeTab === 'finance' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
              data-testid="admin-tab-finance"
            >
              <FiPieChart className="inline mr-2" />FINANCE
            </button>
            <button
              onClick={() => setActiveTab('balance')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
                activeTab === 'balance' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
              data-testid="admin-tab-balance"
            >
              <FiDollarSign className="inline mr-2" />BALANCE
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'sellers' && <SellersManagementTab />}
        {activeTab === 'api-keys' && <IntegrationsPage />}
        {activeTab === 'warehouses' && <WarehousesSection />}
        {activeTab === 'products' && <CatalogProductsPage />}
        {activeTab === 'orders' && <OrdersPage />}
        {activeTab === 'finance' && <FinanceDashboard />}
        {activeTab === 'balance' && <PayoutsPage />}
      </main>
    </div>
  )
}

export default AdminDashboardV2
