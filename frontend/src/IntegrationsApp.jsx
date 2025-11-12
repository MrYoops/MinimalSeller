import React, { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import APIKeysPage from './pages/APIKeysPage'
import ProductMappingPage from './pages/ProductMappingPage'

function IntegrationsApp() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('keys')

  if (!user) {
    return <div className="min-h-screen bg-mm-black text-mm-cyan flex items-center justify-center">
      <p>Загрузка...</p>
    </div>
  }

  return (
    <div className="min-h-screen bg-mm-black text-mm-text">
      {/* Header */}
      <div className="border-b border-mm-border bg-mm-darker">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                MINIMAL<span className="text-mm-purple">MOD</span>
              </h1>
              <p className="comment text-sm">// Интеграции с маркетплейсами</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-mm-text-secondary">{user.email}</span>
              <button onClick={logout} className="btn-secondary text-sm">ВЫЙТИ</button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-mm-border">
        <div className="container mx-auto px-6">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('keys')}
              className={`px-6 py-4 font-mono uppercase text-sm transition-colors ${
                activeTab === 'keys' 
                  ? 'text-mm-cyan border-b-2 border-mm-cyan' 
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              🔑 API KEYS
            </button>
            <button
              onClick={() => setActiveTab('mapping')}
              className={`px-6 py-4 font-mono uppercase text-sm transition-colors ${
                activeTab === 'mapping' 
                  ? 'text-mm-cyan border-b-2 border-mm-cyan' 
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              🔗 СОПОСТАВЛЕНИЕ ТОВАРОВ
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        {activeTab === 'keys' && <APIKeysPage />}
        {activeTab === 'mapping' && <ProductMappingPage />}
      </div>
    </div>
  )
}

export default IntegrationsApp
JSEOF
echo "✅ Created IntegrationsApp - simplified version"
