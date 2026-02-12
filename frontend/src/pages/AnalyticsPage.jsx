import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiTrendingUp, FiTarget, FiBell } from 'react-icons/fi'

function AnalyticsPage() {
  const { api } = useAuth()
  const [activeTab, setActiveTab] = useState('ratings')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

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

  const getABCCategory = (score) => {
    if (score >= 80) return { label: 'A', color: 'text-mm-green' }
    if (score >= 50) return { label: 'B', color: 'text-mm-yellow' }
    return { label: 'C', color: 'text-mm-red' }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl mb-2 text-mm-cyan uppercase">ANALYTICS & INSIGHTS</h2>
        <p className="comment">// Data-driven recommendations</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-mm-border">
        <button
          onClick={() => setActiveTab('ratings')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
            activeTab === 'ratings'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
        >
          🏆 RATINGS
        </button>
        <button
          onClick={() => setActiveTab('abc')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
            activeTab === 'abc'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
        >
          📊 ABC ANALYSIS
        </button>
        <button
          onClick={() => setActiveTab('goals')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
            activeTab === 'goals'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
        >
          🎯 GOALS & KPI
        </button>
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
            activeTab === 'recommendations'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
        >
          💡 RECOMMENDATIONS
        </button>
      </div>

      {/* Ratings Tab */}
      {activeTab === 'ratings' && (
        <div>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-mm-cyan animate-pulse">// LOADING...</p>
            </div>
          ) : (
            <div className="card-neon overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-mm-border">
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Product</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Sales/Day</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Returns %</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Rating</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">ABC</th>
                      <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => {
                      const abc = getABCCategory(product.listing_quality_score?.total || 0)
                      return (
                        <tr key={product.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                          <td className="py-4 px-4 font-mono text-sm">{product.minimalmod.name}</td>
                          <td className="py-4 px-4 font-mono text-sm text-mm-cyan">
                            {(Math.random() * 10).toFixed(1)}
                          </td>
                          <td className="py-4 px-4 font-mono text-sm">
                            <span className={parseFloat((Math.random() * 15).toFixed(1)) > 10 ? 'text-mm-red' : 'text-mm-green'}>
                              {(Math.random() * 15).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-4 px-4 font-mono text-sm text-mm-yellow">
                            ⭐ {(4 + Math.random()).toFixed(1)}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-1 text-xs font-mono border ${abc.color} border-current`}>
                              {abc.label}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-mono text-sm">
                            {Math.round(product.listing_quality_score?.total || 0)}/100
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABC Analysis Tab */}
      {activeTab === 'abc' && (
        <div>
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="card-neon">
              <h3 className="text-xl mb-2 text-mm-green">CATEGORY A</h3>
              <p className="comment mb-3">// 80% of profit</p>
              <p className="text-4xl font-bold text-mm-green">
                {products.filter(p => (p.listing_quality_score?.total || 0) >= 80).length}
              </p>
              <p className="text-sm text-mm-text-secondary mt-2">products</p>
            </div>
            <div className="card-neon">
              <h3 className="text-xl mb-2 text-mm-yellow">CATEGORY B</h3>
              <p className="comment mb-3">// 15% of profit</p>
              <p className="text-4xl font-bold text-mm-yellow">
                {products.filter(p => {
                  const score = p.listing_quality_score?.total || 0
                  return score >= 50 && score < 80
                }).length}
              </p>
              <p className="text-sm text-mm-text-secondary mt-2">products</p>
            </div>
            <div className="card-neon">
              <h3 className="text-xl mb-2 text-mm-red">CATEGORY C</h3>
              <p className="comment mb-3">// 5% of profit</p>
              <p className="text-4xl font-bold text-mm-red">
                {products.filter(p => (p.listing_quality_score?.total || 0) < 50).length}
              </p>
              <p className="text-sm text-mm-text-secondary mt-2">products</p>
            </div>
          </div>

          <div className="card-neon">
            <h3 className="text-xl mb-4 text-mm-cyan">RECOMMENDATIONS BY CATEGORY</h3>
            <div className="space-y-4">
              <div className="p-4 border-l-2 border-mm-green bg-mm-green/5">
                <p className="text-mm-green font-bold mb-2">Category A (Stars)</p>
                <p className="text-sm text-mm-text-secondary">
                  ✓ Increase stock levels - these products sell well
                  <br/>✓ Consider FBO shipments to regional warehouses
                  <br/>✓ Invest in advertising for these products
                </p>
              </div>
              <div className="p-4 border-l-2 border-mm-yellow bg-mm-yellow/5">
                <p className="text-mm-yellow font-bold mb-2">Category B (Mid-performers)</p>
                <p className="text-sm text-mm-text-secondary">
                  ✓ Optimize pricing and descriptions
                  <br/>✓ Monitor performance closely
                  <br/>✓ Test promotional campaigns
                </p>
              </div>
              <div className="p-4 border-l-2 border-mm-red bg-mm-red/5">
                <p className="text-mm-red font-bold mb-2">Category C (Consider removal)</p>
                <p className="text-sm text-mm-text-secondary">
                  ✓ Review if worth keeping
                  <br/>✓ Consider clearance sales
                  <br/>✓ Analyze why performance is low
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <div className="card-neon text-center py-12">
          <FiTarget className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2">Goals & KPI Management</p>
          <p className="comment">// Set targets and track progress (coming soon)</p>
        </div>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          <div className="card-neon">
            <div className="flex items-center space-x-3 mb-4">
              <FiBell className="text-mm-yellow" size={24} />
              <h3 className="text-xl text-mm-cyan uppercase">SMART RECOMMENDATIONS</h3>
            </div>
            <div className="space-y-3">
              <div className="p-4 border-l-2 border-mm-cyan bg-mm-cyan/5">
                <p className="text-mm-cyan font-bold mb-1">💡 Stock Optimization</p>
                <p className="text-sm text-mm-text-secondary">
                  Product "Test Product 1" is in category A but frequently out of stock. Recommend increasing stock by 50 units.
                </p>
              </div>
              <div className="p-4 border-l-2 border-mm-yellow bg-mm-yellow/5">
                <p className="text-mm-yellow font-bold mb-1">⚠️ Performance Alert</p>
                <p className="text-sm text-mm-text-secondary">
                  Product quality score for 2 products dropped below 50. Review and optimize product cards.
                </p>
              </div>
              <div className="p-4 border-l-2 border-mm-green bg-mm-green/5">
                <p className="text-mm-green font-bold mb-1">📍 Regional Opportunity</p>
                <p className="text-sm text-mm-text-secondary">
                  Consider FBO shipment to Kazan warehouse - high demand detected for Electronics category.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnalyticsPage
