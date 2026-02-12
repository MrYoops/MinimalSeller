import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function TestPage() {
  const { api, user } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadProducts = async () => {
    setLoading(true)
    setError('')
    try {
      console.log('🧪 Testing API call...')
      const response = await api.get('/api/products?limit=10')
      console.log('✅ API response:', response.data)
      setProducts(response.data)
    } catch (err) {
      console.error('❌ API error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🧪 Test Page</h1>
      
      <div className="mb-4">
        <p>User: {user?.email}</p>
        <p>API Base URL: {api.defaults.baseURL}</p>
      </div>

      <button 
        onClick={loadProducts}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Loading...' : 'Load Products'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      {products.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Products ({products.length})</h2>
          <div className="space-y-2">
            {products.map(product => (
              <div key={product.id} className="p-4 border rounded">
                <h3 className="font-semibold">{product.name}</h3>
                <p>Article: {product.article}</p>
                <p>Price: {product.price}</p>
                <p>Status: {product.status}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
