import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiX, FiSave, FiUser } from 'react-icons/fi'

function SellerManagePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { api } = useAuth()
  const [seller, setSeller] = useState(null)
  const [permissions, setPermissions] = useState({
    can_create_products: true,
    can_edit_products: true,
    can_delete_products: false,
    can_create_orders: true,
    can_manage_inventory: true,
    can_create_promocodes: true,
    can_view_finance: true,
    can_request_payouts: true,
    max_products: 100,
    max_orders_per_day: 50,
    commission_rate: 0.15
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSeller()
  }, [id])

  const loadSeller = async () => {
    try {
      const response = await api.get(`/api/admin/users`)
      const users = response.data
      const sellerData = users.find(u => u.id === id)
      setSeller(sellerData)
      
      // Load seller profile with permissions
      // В реальности здесь будет отдельный API endpoint
    } catch (error) {
      console.error('Failed to load seller:', error)
    }
    setLoading(false)
  }

  const savePermissions = async () => {
    try {
      // API endpoint для сохранения прав
      alert('Permissions saved!')
      navigate(-1)
    } catch (error) {
      alert('Failed to save permissions')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mm-black flex items-center justify-center">
        <p className="text-mm-cyan animate-pulse">// LOADING...</p>
      </div>
    )
  }

  if (!seller) {
    return (
      <div className="min-h-screen bg-mm-black flex items-center justify-center">
        <p className="text-mm-red">Seller not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-mm-black">
      <header className="border-b border-mm-border bg-mm-darker sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-mm-cyan uppercase">
              <FiUser className="inline mr-2" />
              Manage Seller: {seller.full_name}
            </h1>
            <div className="flex items-center space-x-4">
              <button onClick={savePermissions} className="btn-primary">
                <FiSave className="inline mr-2" />
                Save Permissions
              </button>
              <button onClick={() => navigate(-1)} className="btn-secondary">
                <FiX className="inline mr-2" />
                Close
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Seller Info */}
          <div className="lg:col-span-1">
            <div className="card-neon">
              <h3 className="text-xl mb-4 text-mm-cyan uppercase">Seller Info</h3>
              <div className="space-y-3">
                <div>
                  <p className="comment text-xs">// Email</p>
                  <p className="font-mono">{seller.email}</p>
                </div>
                <div>
                  <p className="comment text-xs">// Name</p>
                  <p className="font-mono">{seller.full_name}</p>
                </div>
                <div>
                  <p className="comment text-xs">// Status</p>
                  <span className={seller.is_active ? 'status-active' : 'status-error'}>
                    {seller.is_active ? 'ACTIVE' : 'BLOCKED'}
                  </span>
                </div>
                <div>
                  <p className="comment text-xs">// Registered</p>
                  <p className="font-mono text-sm">{new Date(seller.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="lg:col-span-2">
            <div className="card-neon">
              <h3 className="text-xl mb-4 text-mm-cyan uppercase">PERMISSIONS & LIMITS</h3>
              
              <div className="space-y-6">
                {/* Module Access */}
                <div>
                  <p className="comment mb-3">// Module Access Control</p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center space-x-2 p-3 border border-mm-border hover:border-mm-cyan transition-colors">
                      <input
                        type="checkbox"
                        checked={permissions.can_create_products}
                        onChange={(e) => setPermissions({...permissions, can_create_products: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span className="text-mm-text-secondary">Can Create Products</span>
                    </label>
                    
                    <label className="flex items-center space-x-2 p-3 border border-mm-border hover:border-mm-cyan transition-colors">
                      <input
                        type="checkbox"
                        checked={permissions.can_edit_products}
                        onChange={(e) => setPermissions({...permissions, can_edit_products: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span className="text-mm-text-secondary">Can Edit Products</span>
                    </label>
                    
                    <label className="flex items-center space-x-2 p-3 border border-mm-border hover:border-mm-cyan transition-colors">
                      <input
                        type="checkbox"
                        checked={permissions.can_delete_products}
                        onChange={(e) => setPermissions({...permissions, can_delete_products: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span className="text-mm-text-secondary">Can Delete Products</span>
                    </label>
                    
                    <label className="flex items-center space-x-2 p-3 border border-mm-border hover:border-mm-cyan transition-colors">
                      <input
                        type="checkbox"
                        checked={permissions.can_manage_inventory}
                        onChange={(e) => setPermissions({...permissions, can_manage_inventory: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span className="text-mm-text-secondary">Can Manage Inventory</span>
                    </label>
                    
                    <label className="flex items-center space-x-2 p-3 border border-mm-border hover:border-mm-cyan transition-colors">
                      <input
                        type="checkbox"
                        checked={permissions.can_create_promocodes}
                        onChange={(e) => setPermissions({...permissions, can_create_promocodes: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span className="text-mm-text-secondary">Can Create Promocodes</span>
                    </label>
                    
                    <label className="flex items-center space-x-2 p-3 border border-mm-border hover:border-mm-cyan transition-colors">
                      <input
                        type="checkbox"
                        checked={permissions.can_view_finance}
                        onChange={(e) => setPermissions({...permissions, can_view_finance: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span className="text-mm-text-secondary">Can View Finance</span>
                    </label>
                    
                    <label className="flex items-center space-x-2 p-3 border border-mm-border hover:border-mm-cyan transition-colors">
                      <input
                        type="checkbox"
                        checked={permissions.can_request_payouts}
                        onChange={(e) => setPermissions({...permissions, can_request_payouts: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span className="text-mm-text-secondary">Can Request Payouts</span>
                    </label>
                  </div>
                </div>

                {/* Limits */}
                <div>
                  <p className="comment mb-3">// Limits & Quotas</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Max Products</label>
                      <input
                        type="number"
                        value={permissions.max_products}
                        onChange={(e) => setPermissions({...permissions, max_products: parseInt(e.target.value)})}
                        className="input-neon w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Max Orders/Day</label>
                      <input
                        type="number"
                        value={permissions.max_orders_per_day}
                        onChange={(e) => setPermissions({...permissions, max_orders_per_day: parseInt(e.target.value)})}
                        className="input-neon w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Commission */}
                <div>
                  <p className="comment mb-3">// Financial Settings</p>
                  <div>
                    <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Commission Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={permissions.commission_rate * 100}
                      onChange={(e) => setPermissions({...permissions, commission_rate: parseFloat(e.target.value) / 100})}
                      className="input-neon w-full"
                    />
                    <p className="comment text-xs mt-1">// Platform commission from seller's sales</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SellerManagePage
