import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiUsers, FiPackage, FiShoppingCart, FiDollarSign, FiTrendingUp } from 'react-icons/fi'

function AdminGlobalDashboard() {
  const { api } = useAuth()
  const [stats, setStats] = useState({
    total_sellers: 0,
    total_products: 0,
    total_orders: 0,
    total_revenue: 0,
    total_net_profit: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const response = await api.get('/api/admin/dashboard')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to load admin dashboard:', error)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-mm-cyan animate-pulse">// LOADING...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl mb-2 text-mm-cyan uppercase">GLOBAL PLATFORM DASHBOARD</h2>
        <p className="comment">// Overview of entire platform</p>
      </div>

      {/* Key Platform Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card-neon">
          <div className="flex items-center justify-between mb-2">
            <p className="comment">// Active Sellers</p>
            <FiUsers className="text-mm-cyan" size={24} />
          </div>
          <p className="text-4xl font-bold text-mm-cyan">{stats.total_sellers}</p>
        </div>
        
        <div className="card-neon">
          <div className="flex items-center justify-between mb-2">
            <p className="comment">// Total Products</p>
            <FiPackage className="text-mm-purple" size={24} />
          </div>
          <p className="text-4xl font-bold text-mm-purple">{stats.total_products}</p>
        </div>
        
        <div className="card-neon">
          <div className="flex items-center justify-between mb-2">
            <p className="comment">// Total Orders</p>
            <FiShoppingCart className="text-mm-yellow" size={24} />
          </div>
          <p className="text-4xl font-bold text-mm-yellow">{stats.total_orders}</p>
        </div>
        
        <div className="card-neon">
          <div className="flex items-center justify-between mb-2">
            <p className="comment">// Platform Revenue</p>
            <FiDollarSign className="text-mm-green" size={24} />
          </div>
          <p className="text-3xl font-bold text-mm-green">₽{stats.total_revenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="card-neon">
        <h3 className="text-xl mb-4 text-mm-cyan uppercase">FINANCIAL OVERVIEW</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="comment mb-2">// Total Revenue</p>
            <p className="text-3xl font-bold text-mm-green flex items-center">
              <FiTrendingUp className="mr-2" />
              ₽{stats.total_revenue.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="comment mb-2">// Net Profit</p>
            <p className={`text-3xl font-bold flex items-center ${
              stats.total_net_profit >= 0 ? 'text-mm-green' : 'text-mm-red'
            }`}>
              <FiDollarSign className="mr-2" />
              ₽{stats.total_net_profit.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Platform Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-neon">
          <h3 className="text-xl mb-4 text-mm-cyan uppercase">PLATFORM HEALTH</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-mm-text-secondary">Average Products per Seller</span>
              <span className="font-bold">
                {stats.total_sellers > 0 ? Math.round(stats.total_products / stats.total_sellers) : 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-mm-text-secondary">Average Orders per Seller</span>
              <span className="font-bold">
                {stats.total_sellers > 0 ? Math.round(stats.total_orders / stats.total_sellers) : 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-mm-text-secondary">Average Revenue per Seller</span>
              <span className="font-bold text-mm-green">
                ₽{stats.total_sellers > 0 ? Math.round(stats.total_revenue / stats.total_sellers).toLocaleString() : 0}
              </span>
            </div>
          </div>
        </div>

        <div className="card-neon">
          <h3 className="text-xl mb-4 text-mm-cyan uppercase">COMING SOON</h3>
          <ul className="space-y-2 text-mm-text-secondary font-mono text-sm">
            <li>• Top 10 Sellers by Revenue</li>
            <li>• Marketplace Performance Comparison</li>
            <li>• Growth Trends (Week/Month/Year)</li>
            <li>• Revenue by Category</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default AdminGlobalDashboard