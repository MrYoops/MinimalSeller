import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiKey, FiLink, FiLogOut } from 'react-icons/fi'
import APIKeysPage from './APIKeysPage'
import ProductMappingPage from './ProductMappingPage'

function SellerDashboardLite() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('integrations')

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
              <p className="comment text-sm">Панель интеграций с маркетплейсами</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-mm-text-secondary">{user.full_name}</p>
                <p className="text-xs text-mm-text-tertiary">{user.email}</p>
              </div>
              <button onClick={logout} className="btn-secondary text-sm">
                <FiLogOut className="inline mr-2" />
                ВЫЙТИ
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="border-b border-mm-border">
        <div className="container mx-auto px-6">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('integrations')}
              className={`px-6 py-4 font-mono uppercase text-sm transition-colors ${
                activeTab === 'integrations' 
                  ? 'text-mm-cyan border-b-2 border-mm-cyan' 
                  : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiKey className="inline mr-2" />
              ИНТЕГРАЦИИ
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        {activeTab === 'integrations' && <IntegrationsContent />}
      </div>
    </div>
  )
}

function IntegrationsContent() {
  const [subTab, setSubTab] = useState('keys')

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex space-x-4 border-b border-mm-border">
        <button
          onClick={() => setSubTab('keys')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
            subTab === 'keys' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
        >
          <FiKey className="inline mr-2" />
          API KEYS
        </button>
        <button
          onClick={() => setSubTab('mapping')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
            subTab === 'mapping' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
        >
          <FiLink className="inline mr-2" />
          СОПОСТАВЛЕНИЕ ТОВАРОВ
        </button>
      </div>

      {/* Content */}
      {subTab === 'keys' && <APIKeysPage />}
      {subTab === 'mapping' && <ProductMappingPage />}
    </div>
  )
}

export default SellerDashboardLite
