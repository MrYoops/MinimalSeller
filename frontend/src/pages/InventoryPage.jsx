import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiPackage, FiTrendingUp, FiTrendingDown } from 'react-icons/fi'

function InventoryPage() {
  const { api } = useAuth()
  const [activeTab, setActiveTab] = useState('fbs')
  const [inventory, setInventory] = useState([])
  const [fboInventory, setFboInventory] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showFBOShipmentModal, setShowFBOShipmentModal] = useState(false)
  const [adjustData, setAdjustData] = useState({
    product_id: '',
    quantity_change: '',
    reason: ''
  })
  const [fboShipment, setFBOShipment] = useState({
    marketplace: 'ozon',
    warehouse: '',
    products: []
  })
  const [products, setProducts] = useState([])

  useEffect(() => {
    loadData()
    loadProducts()
  }, [activeTab])

  const loadProducts = async () => {
    try {
      const response = await api.get('/api/products')
      setProducts(response.data)
    } catch (error) {
      console.error('Failed to load products:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'fbs') {
        const response = await api.get('/api/inventory')
        setInventory(response.data)
      } else if (activeTab === 'fbo') {
        const response = await api.get('/api/inventory/fbo')
        setFboInventory(response.data)
      } else if (activeTab === 'history') {
        const response = await api.get('/api/inventory/history')
        setHistory(response.data)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    }
    setLoading(false)
  }

  const handleAdjust = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/api/inventory/${adjustData.product_id}/adjust`, {
        quantity_change: parseInt(adjustData.quantity_change),
        reason: adjustData.reason
      })
      setShowAdjustModal(false)
      setAdjustData({ product_id: '', quantity_change: '', reason: '' })
      loadData()
      alert('Inventory adjusted successfully!')
    } catch (error) {
      console.error('Failed to adjust inventory:', error)
      alert('Failed to adjust: ' + (error.response?.data?.detail || error.message))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl mb-2 text-mm-cyan uppercase">Inventory & Stock</h2>
        <p className="comment">// Manage warehouse and stock levels</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-mm-border">
        <button
          onClick={() => setActiveTab('fbs')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
            activeTab === 'fbs'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
        >
          FBS (Own Warehouse)
        </button>
        <button
          onClick={() => setActiveTab('fbo')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
            activeTab === 'fbo'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
        >
          FBO (Marketplace Warehouses)
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
            activeTab === 'history'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
        >
          Movement History
        </button>
      </div>

      {/* FBS Tab */}
      {activeTab === 'fbs' && (
        <div>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-mm-cyan animate-pulse">// LOADING...</p>
            </div>
          ) : inventory.length === 0 ? (
            <div className="card-neon text-center py-12">
              <FiPackage className="mx-auto text-mm-text-tertiary mb-4" size={48} />
              <p className="text-mm-text-secondary mb-2">No inventory records</p>
              <p className="comment">// Add products first, then manage stock</p>
            </div>
          ) : (
            <div className="card-neon overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-mm-border">
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">SKU</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Product</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Total</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Reserved</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Available</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Alert</th>
                      <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item) => (
                      <tr key={item.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                        <td className="py-4 px-4 font-mono text-sm text-mm-cyan">{item.sku}</td>
                        <td className="py-4 px-4 font-mono text-sm">{item.product_name || 'N/A'}</td>
                        <td className="py-4 px-4 font-mono text-sm">{item.quantity}</td>
                        <td className="py-4 px-4 font-mono text-sm text-mm-yellow">{item.reserved}</td>
                        <td className="py-4 px-4 font-mono text-sm">
                          <span className={item.available <= (item.alert_threshold || 0) ? 'text-mm-red' : 'text-mm-green'}>
                            {item.available}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                          {item.alert_threshold || 10}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => {
                              setAdjustData({...adjustData, product_id: item.product_id})
                              setShowAdjustModal(true)
                            }}
                            className="px-3 py-1 border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 transition-colors text-xs uppercase font-mono"
                          >
                            Adjust
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

      {/* FBO Tab */}
      {activeTab === 'fbo' && (
        <div>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-mm-cyan animate-pulse">// LOADING...</p>
            </div>
          ) : fboInventory.length === 0 ? (
            <div className="card-neon text-center py-12">
              <FiPackage className="mx-auto text-mm-text-tertiary mb-4" size={48} />
              <p className="text-mm-text-secondary mb-2">No FBO inventory</p>
              <p className="comment">// FBO stock will appear here</p>
            </div>
          ) : (
            <div className="card-neon overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-mm-border">
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">SKU</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Product</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Marketplace</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Warehouse</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fboInventory.map((item) => (
                      <tr key={item.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                        <td className="py-4 px-4 font-mono text-sm text-mm-cyan">{item.sku}</td>
                        <td className="py-4 px-4 font-mono text-sm">{item.product_name || 'N/A'}</td>
                        <td className="py-4 px-4">
                          <span className="px-2 py-1 text-xs font-mono border border-mm-purple text-mm-purple">
                            {item.marketplace}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">{item.warehouse_name}</td>
                        <td className="py-4 px-4 font-mono text-sm text-mm-green">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-mm-cyan animate-pulse">// LOADING...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="card-neon text-center py-12">
              <p className="text-mm-text-secondary mb-2">No movement history</p>
              <p className="comment">// All stock movements will be logged here</p>
            </div>
          ) : (
            <div className="card-neon overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-mm-border">
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Date</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">SKU</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Product</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Operation</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Change</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                        <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                          {new Date(item.created_at).toLocaleString()}
                        </td>
                        <td className="py-4 px-4 font-mono text-sm text-mm-cyan">{item.sku}</td>
                        <td className="py-4 px-4 font-mono text-sm">{item.product_name || 'N/A'}</td>
                        <td className="py-4 px-4">
                          <span className="px-2 py-1 text-xs font-mono border border-mm-cyan text-mm-cyan">
                            {item.operation_type}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono text-sm">
                          <span className={`flex items-center space-x-1 ${item.quantity_change > 0 ? 'text-mm-green' : 'text-mm-red'}`}>
                            {item.quantity_change > 0 ? <FiTrendingUp /> : <FiTrendingDown />}
                            <span>{item.quantity_change > 0 ? '+' : ''}{item.quantity_change}</span>
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Adjust Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card-neon max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl text-mm-cyan">ADJUST INVENTORY</h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="text-mm-text-secondary hover:text-mm-red transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdjust} className="space-y-6">
              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">
                  Quantity Change
                </label>
                <input
                  type="number"
                  value={adjustData.quantity_change}
                  onChange={(e) => setAdjustData({...adjustData, quantity_change: e.target.value})}
                  className="input-neon w-full"
                  placeholder="+100 or -50"
                  required
                />
                <p className="comment text-xs mt-1">// Use + for adding, - for removing</p>
              </div>

              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">
                  Reason
                </label>
                <textarea
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({...adjustData, reason: e.target.value})}
                  className="input-neon w-full"
                  rows="3"
                  placeholder="Reason for adjustment..."
                  required
                />
              </div>

              <div className="flex space-x-4">
                <button type="submit" className="btn-primary flex-1">
                  ADJUST STOCK
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
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

export default InventoryPage
