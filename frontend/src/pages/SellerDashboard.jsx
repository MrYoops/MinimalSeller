import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiLogOut, FiKey, FiPackage, FiShoppingCart, FiBox, FiDollarSign, FiPieChart, FiLink, FiTrash2, FiEdit } from 'react-icons/fi'
import { BsBoxSeam } from 'react-icons/bs'
import SettingsDropdown from '../components/SettingsDropdown'
import IntegrationsPage from './IntegrationsPage'
import OrdersPage from './OrdersPage'
import InventoryPage from './InventoryPage'
import FinanceDashboard from './FinanceDashboard'
import PayoutsPage from './PayoutsPage'
import ProductMappingPage from './ProductMappingPage'
import WarehousesPage from './WarehousesPage'
import WarehousesSection from './WarehousesSection'
import ProductsPage from './ProductsPage'
import StockPage from './StockPage'
import CatalogProductsPage from './CatalogProductsPage'

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
              onClick={() => setActiveTab('warehouses')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
                activeTab === 'warehouses' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <BsBoxSeam className="inline mr-2" />СКЛАД
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
                activeTab === 'products' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiPackage className="inline mr-2" />ТОВАРЫ
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
        {activeTab === 'api-keys' && <IntegrationsPage />}
        
        {activeTab === 'warehouses' && <WarehousesSection />}
        
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl mb-2 text-mm-cyan uppercase">ТОВАРЫ</h2>
              <button onClick={() => window.location.href = '/products/new/edit'} className="btn-primary">
                + ДОБАВИТЬ ТОВАР
              </button>
            </div>
            
            {loading ? (
              <div className="text-center py-12"><p className="text-mm-cyan animate-pulse">// LOADING...</p></div>
            ) : products.length === 0 ? (
              <div className="card-neon text-center py-12">
                <FiPackage className="mx-auto text-mm-text-tertiary mb-4" size={48} />
                <p className="text-mm-text-secondary">Товаров пока нет</p>
                <p className="text-mm-text-tertiary text-sm mt-2">Перейдите в раздел ИНТЕГРАЦИИ → СОПОСТАВЛЕНИЕ ТОВАРОВ для загрузки</p>
              </div>
            ) : (
              <div className="card-neon overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="border-b border-mm-border bg-mm-black/50">
                      <th className="text-left py-3 px-3 text-mm-text-secondary uppercase text-xs font-mono w-20">Фото</th>
                      <th className="text-left py-3 px-3 text-mm-text-secondary uppercase text-xs font-mono w-32">SKU</th>
                      <th className="text-left py-3 px-3 text-mm-text-secondary uppercase text-xs font-mono">Название</th>
                      <th className="text-left py-3 px-3 text-mm-text-secondary uppercase text-xs font-mono w-32">Категория</th>
                      <th className="text-left py-3 px-3 text-mm-text-secondary uppercase text-xs font-mono w-24">Цена</th>
                      <th className="text-left py-3 px-3 text-mm-text-secondary uppercase text-xs font-mono w-24">Статус</th>
                      <th className="text-left py-3 px-3 text-mm-text-secondary uppercase text-xs font-mono w-28">Источник</th>
                      <th className="text-right py-3 px-3 text-mm-text-secondary uppercase text-xs font-mono w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => {
                      const marketplaces = product.marketplace_data ? Object.keys(product.marketplace_data) : []
                      const hasWB = marketplaces.includes('wb')
                      const hasOzon = marketplaces.includes('ozon')
                      const hasYandex = marketplaces.includes('yandex')
                      
                      return (
                      <tr key={product.id} className="border-b border-mm-border hover:bg-mm-gray/50 transition-colors">
                        <td className="py-3 px-3">
                          {product.images && product.images[0] ? (
                            <img src={product.images[0]} alt={product.name} className="w-12 h-12 object-cover border border-mm-border rounded" />
                          ) : (
                            <div className="w-12 h-12 bg-mm-gray border border-mm-border rounded flex items-center justify-center">
                              <span className="text-xs text-mm-text-tertiary">NO</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-xs text-mm-cyan truncate">{product.sku}</td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-sm truncate">{product.name}</div>
                          {product.description && (
                            <div className="text-xs text-mm-text-tertiary mt-1 truncate">
                              {product.description.substring(0, 50)}...
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs text-mm-text-secondary truncate">
                          {product.marketplace_data?.wb?.category || 
                           product.marketplace_data?.ozon?.category || 
                           product.category || 'N/A'}
                        </td>
                        <td className="py-3 px-3 font-mono text-sm text-mm-cyan">₽{product.price}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-1 text-xs font-mono uppercase rounded inline-block ${
                            product.status === 'active' ? 'bg-mm-green/20 text-mm-green' : 
                            'bg-mm-yellow/20 text-mm-yellow'
                          }`}>
                            {product.status === 'active' ? 'ACT' : 'PND'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex gap-1 flex-wrap">
                            {hasWB && <span className="text-xs px-1.5 py-0.5 bg-mm-purple/20 text-mm-purple rounded font-mono">WB</span>}
                            {hasOzon && <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded font-mono">OZ</span>}
                            {hasYandex && <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded font-mono">YM</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={async () => {
                                if (confirm(`Удалить товар "${product.name}"?`)) {
                                  try {
                                    await api.delete(`/api/products/${product.id}`)
                                    alert('✅ Товар удалён!')
                                    loadProducts()
                                  } catch (error) {
                                    alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
                                  }
                                }
                              }}
                              className="p-2 text-mm-red hover:bg-mm-red/10 rounded transition-colors"
                              title="Удалить"
                            >
                              <FiTrash2 size={14} />
                            </button>
                            <button
                              onClick={() => window.location.href = `/products/${product.id}/edit`}
                              className="p-2 text-mm-cyan hover:bg-mm-cyan/10 rounded transition-colors"
                              title="Редактировать"
                            >
                              <FiEdit size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'old-products' && (
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
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Category</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Characteristics</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Price</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Status</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Source</th>
                      <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => {
                      const marketplaces = product.marketplace_data ? Object.keys(product.marketplace_data) : []
                      const hasWB = marketplaces.includes('wb')
                      
                      return (
                      <tr key={product.id} className="border-b border-mm-border hover:bg-mm-gray">
                        <td className="py-4 px-4">
                          {product.images && product.images[0] ? (
                            <img src={product.images[0]} alt={product.name} className="w-16 h-16 object-cover border border-mm-border" />
                          ) : (
                            <div className="w-16 h-16 bg-mm-gray border border-mm-border flex items-center justify-center">
                              <span className="text-xs">NO IMG</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 font-mono text-sm text-mm-cyan">{product.sku}</td>
                        <td className="py-4 px-4">
                          <div className="font-semibold">{product.name}</div>
                          {product.description && (
                            <div className="text-xs text-mm-text-secondary mt-1 max-w-xs truncate">
                              {product.description.substring(0, 80)}...
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-sm text-mm-text-secondary">
                          {product.marketplace_data?.wb?.category || 'N/A'}
                        </td>
                        <td className="py-4 px-4 text-sm">
                          {product.attributes && Object.keys(product.attributes).length > 0 ? (
                            <div className="text-mm-green">
                              {Object.keys(product.attributes).length} шт
                              <div className="text-xs text-mm-text-tertiary mt-1">
                                {Object.entries(product.attributes).slice(0, 2).map(([key, val]) => (
                                  <div key={key}>{key}: {val}</div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="text-mm-text-tertiary">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-mono">₽{product.price}</td>
                        <td className="py-4 px-4">
                          <span className={product.status === 'active' ? 'status-active' : 'status-pending'}>
                            {product.status}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {hasWB && <span className="text-xs px-2 py-1 bg-mm-purple/20 text-mm-purple border border-mm-purple">WB</span>}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={async () => {
                              if (confirm(`Удалить товар "${product.name}"?`)) {
                                try {
                                  await api.delete(`/api/products/${product.id}`)
                                  alert('✅ Товар удалён!')
                                  loadProducts()
                                } catch (error) {
                                  alert('❌ Ошибка удаления: ' + (error.response?.data?.detail || error.message))
                                }
                              }
                            }}
                            className="px-3 py-2 border border-mm-red text-mm-red hover:bg-mm-red/10 transition-colors mr-2"
                            title="Удалить товар"
                          >
                            <FiTrash2 size={16} />
                          </button>
                          <button
                            onClick={() => window.location.href = `/products/${product.id}/edit`}
                            className="px-3 py-2 border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 transition-colors"
                            title="Редактировать товар"
                          >
                            <FiEdit size={16} />
                          </button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && <OrdersPage />}
        {activeTab === 'finance' && <FinanceDashboard />}
        {activeTab === 'balance' && <PayoutsPage />}
      </main>
    </div>
  )
}

export default SellerDashboard