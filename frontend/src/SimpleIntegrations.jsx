import React, { useState } from 'react'
import { useAuth } from './context/AuthContext'
import APIKeysPage from './pages/APIKeysPage'
import ProductMappingPage from './pages/ProductMappingPage'

function SimpleIntegrations() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState('keys')

  return (
    <div style={{ background: '#121212', color: '#FFFFFF', minHeight: '100vh', fontFamily: 'monospace' }}>
      <div style={{ borderBottom: '1px solid #424242', padding: '20px', background: '#1E1E1E' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1400px', margin: '0 auto' }}>
          <div>
            <h1 style={{ fontSize: '24px', color: '#00FFFF', marginBottom: '5px' }}>MINIMALMOD</h1>
            <p style={{ fontSize: '12px', color: '#BDBDBD' }}>{user.email} ({user.role})</p>
          </div>
          <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer', border: '1px solid #00FFFF', background: 'transparent', color: '#00FFFF' }}>
            ВЫЙТИ
          </button>
        </div>
      </div>

      <div style={{ borderBottom: '1px solid #424242', background: '#1E1E1E' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex' }}>
          <button 
            onClick={() => setTab('keys')}
            style={{ 
              padding: '15px 30px', 
              border: 'none',
              borderBottom: tab === 'keys' ? '2px solid #00FFFF' : '2px solid transparent',
              background: 'transparent',
              color: tab === 'keys' ? '#00FFFF' : '#BDBDBD',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔑 API KEYS
          </button>
          <button 
            onClick={() => setTab('mapping')}
            style={{ 
              padding: '15px 30px', 
              border: 'none',
              borderBottom: tab === 'mapping' ? '2px solid #00FFFF' : '2px solid transparent',
              background: 'transparent',
              color: tab === 'mapping' ? '#00FFFF' : '#BDBDBD',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔗 СОПОСТАВЛЕНИЕ
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '30px 20px' }}>
        {tab === 'keys' && <APIKeysPage />}
        {tab === 'mapping' && <ProductMappingPage />}
      </div>
    </div>
  )
}

export default SimpleIntegrations
