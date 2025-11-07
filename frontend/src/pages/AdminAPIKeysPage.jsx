import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiKey } from 'react-icons/fi'

function AdminAPIKeysPage() {
  const { api } = useAuth()
  const [sellers, setSellers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSellers()
  }, [])

  const loadSellers = async () => {
    try {
      const response = await api.get('/api/admin/users')
      const sellerUsers = response.data.filter(u => u.role === 'seller')
      
      // Для каждого продавца получаем его API ключи
      for (let seller of sellerUsers) {
        // В реальности здесь будет endpoint /api/admin/sellers/{id}/api-keys
        seller.api_keys = [] // Mock
      }
      
      setSellers(sellerUsers)
    } catch (error) {
      console.error('Failed to load sellers:', error)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl mb-2 text-mm-cyan uppercase">API KEYS OVERVIEW</h2>
        <p className="comment">// View all seller API keys for marketplaces</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sellers.map((seller) => (
            <div key={seller.id} className="card-neon">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg text-mm-cyan">{seller.full_name}</h3>
                  <p className="comment text-xs">{seller.email}</p>
                </div>
                <span className={seller.is_active ? 'status-active' : 'status-error'}>
                  {seller.is_active ? 'ACTIVE' : 'BLOCKED'}
                </span>
              </div>

              {seller.api_keys && seller.api_keys.length > 0 ? (
                <div className="space-y-2">
                  {seller.api_keys.map((key, idx) => (
                    <div key={idx} className="p-3 bg-mm-darker border border-mm-border">
                      <div className="flex justify-between">
                        <span className="font-mono text-mm-cyan uppercase">{key.marketplace}</span>
                        <span className="font-mono text-sm text-mm-text-secondary">
                          Client ID: {key.client_id}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <FiKey className="mx-auto text-mm-text-tertiary mb-2" size={24} />
                  <p className="comment text-xs">// No API keys configured</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AdminAPIKeysPage
