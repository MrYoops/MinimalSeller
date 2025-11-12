import React, { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import APIKeysPage from './pages/APIKeysPage'
import ProductMappingPage from './pages/ProductMappingPage'

function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('seller@test.com')
  const [password, setPassword] = useState('password123')
  const [message, setMessage] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    const result = await login(email, password)
    if (!result.success) {
      setMessage('❌ ' + (result.error || 'Ошибка входа'))
    }
  }

  return (
    <div style={{ background: '#121212', color: '#00FFFF', minHeight: '100vh', padding: '50px', fontFamily: 'monospace' }}>
      <h1>MINIMALMOD - LOGIN</h1>
      <form onSubmit={handleLogin} style={{ marginTop: '30px' }}>
        <div style={{ marginBottom: '20px' }}>
          <label>Email:</label><br/>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '10px', width: '300px', marginTop: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label>Password:</label><br/>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '10px', width: '300px', marginTop: '5px' }}
          />
        </div>
        <button type="submit" style={{ padding: '10px 30px', cursor: 'pointer', background: '#00FFFF', color: '#121212', border: 'none', fontWeight: 'bold' }}>
          ВОЙТИ
        </button>
      </form>
      {message && <p style={{ marginTop: '20px', color: '#FF4500' }}>{message}</p>}
    </div>
  )
}

function Dashboard() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState('keys')

  return (
    <div className="min-h-screen bg-mm-black text-mm-text">
      <div className="border-b border-mm-border bg-mm-darker">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">MINIMAL<span className="text-mm-purple">MOD</span></h1>
            <p className="text-sm text-mm-text-secondary">{user.email}</p>
          </div>
          <button onClick={logout} className="px-4 py-2 border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10">ВЫЙТИ</button>
        </div>
      </div>

      <div className="border-b border-mm-border">
        <div className="max-w-7xl mx-auto px-6 flex space-x-4">
          <button onClick={() => setTab('keys')} className={`px-4 py-3 font-mono uppercase text-sm ${tab === 'keys' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary'}`}>
            API KEYS
          </button>
          <button onClick={() => setTab('mapping')} className={`px-4 py-3 font-mono uppercase text-sm ${tab === 'mapping' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary'}`}>
            СОПОСТАВЛЕНИЕ
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {tab === 'keys' && <APIKeysPage />}
        {tab === 'mapping' && <ProductMappingPage />}
      </div>
    </div>
  )
}

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-mm-black flex items-center justify-center">
        <p className="text-mm-cyan animate-pulse">LOADING...</p>
      </div>
    )
  }

  if (!user) return <LoginScreen />
  return <Dashboard />
}

function SimpleApp() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default SimpleApp
